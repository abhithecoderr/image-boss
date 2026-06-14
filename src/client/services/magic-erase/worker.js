import * as ort from 'onnxruntime-web';
import { createProgressReporter, fetchWithProgress, configureOrt } from '../../core/worker-utils.js';
import {
    getMeta,
    getDims,
    detectLayout,
    normalizeDims,
    packLamaTensors,
    unpackLamaOutput
} from './helpers.js';

let session = null;
let modelURL = '';
let lastSessionOptions = null;

const DEBUG = false;

// Configure ORT
configureOrt(ort, self.crossOriginIsolated ? 4 : 1);

function wlog(...args) {
    if (!DEBUG) return;
    const ts = new Date().toISOString();
    console.log(`[MagicErase Worker ${ts}]`, ...args);
}



function buildSessionOptions(executionProviders) {
    return {
        executionProviders,
        graphOptimizationLevel: 'basic'
    };
}

async function initSession(url) {
    if (session && modelURL === url) return;

    if (session) {
        try {
            await session.release();
        } catch (e) {
            console.warn("Failed to release old session:", e);
        }
    }

    modelURL = url;
    
    // Forced 'wasm' for LaMa due to WebGPU broadcast mismatches in FFC layers
    const providers = ['wasm'];
    const primaryProvider = 'wasm';

    try {
        const onProgress = (prog, msg) => self.postMessage({ type: 'init-status', provider: primaryProvider, payload: { message: msg, progress: prog } });
        const report = createProgressReporter(onProgress);

        wlog("Attempting to load session", { providers, modelURL });
        lastSessionOptions = buildSessionOptions(providers);

        const modelBuffer = await fetchWithProgress(
            modelURL,
            'LaMa inpainting model (~50MB)',
            report,
            0.1,
            0.8,
            'lama-model-cache-v1'
        );

        report(0.8, 0.8, 'Compiling ONNX WebAssembly Graph...')();
        session = await ort.InferenceSession.create(modelBuffer, lastSessionOptions);
        
        wlog("Session loaded");
    } catch (e) {
        console.error("Worker failed to initial load model:", e);
        throw e;
    }
}

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'init') {
        try {
            await initSession(payload.modelURL);
            const info = {
                inputs: session.inputNames.map((name, idx) => ({
                    name,
                    shape: getDims(getMeta(session.inputMetadata, name, idx))
                })),
                outputs: session.outputNames.map((name, idx) => ({
                    name,
                    shape: getDims(getMeta(session.outputMetadata, name, idx))
                }))
            };
            wlog("Model metadata", info);
            self.postMessage({ type: 'ready', info });
        } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
        }
    } else if (type === 'inpaint') {
        try {
            const t0 = performance.now();
            const { image, mask, options = {} } = payload; 
            const strength = typeof options.strength === 'number' ? options.strength : 1.0;

            const imageKey = session.inputNames.find(n => {
                const idx = session.inputNames.indexOf(n);
                const dims = getDims(getMeta(session.inputMetadata, n, idx));
                return Array.isArray(dims) && (dims.includes(3) || n.toLowerCase().includes('image'));
            }) || session.inputNames[0];

            const maskKey = session.inputNames.find(n => {
                return n !== imageKey;
            }) || session.inputNames[1];

            const imageIdx = session.inputNames.indexOf(imageKey);
            const maskIdx = session.inputNames.indexOf(maskKey);
            const imgShape = normalizeDims(getDims(getMeta(session.inputMetadata, imageKey, imageIdx)), 3);
            const maskShape = normalizeDims(getDims(getMeta(session.inputMetadata, maskKey, maskIdx)), 1);
            const inputLayout = detectLayout(imgShape);
            const isNHWC = inputLayout === 'NHWC';

            if (!self._lamaImageTensorData || self._lamaImageTensorData.length !== 3 * 512 * 512) {
                self._lamaImageTensorData = new Float32Array(3 * 512 * 512);
            }
            if (!self._lamaMaskTensorData || self._lamaMaskTensorData.length !== 512 * 512) {
                self._lamaMaskTensorData = new Float32Array(512 * 512);
            }
            const imageTensorData = self._lamaImageTensorData;
            const maskTensorData = self._lamaMaskTensorData;

            packLamaTensors(image, mask, imageTensorData, maskTensorData, isNHWC);

            const imageTensor = new ort.Tensor('float32', imageTensorData, imgShape);
            const maskTensor = new ort.Tensor('float32', maskTensorData, maskShape);

            const feeds = {};
            feeds[imageKey] = imageTensor;
            feeds[maskKey] = maskTensor;

            const results = await session.run(feeds);
            const outputName = session.outputNames[0];
            const outputTensor = results[outputName];
            const outShape = outputTensor.dims;
            const outputLayout = detectLayout(outShape);
            const isOutNHWC = outputLayout === 'NHWC';

            const finalData = outputTensor.data;

            let min = finalData[0];
            let max = finalData[0];
            const outLen = finalData.length;
            for (let i = 1; i < outLen; i++) {
                const val = finalData[i];
                if (val < min) min = val;
                else if (val > max) max = val;
            }

            const range = max - min;
            let scaleMode = 0;
            if (min >= -1.05 && max <= 1.05) {
                scaleMode = min < -0.1 ? 1 : 2;
            } else if (min >= 0 && max <= 255.5) {
                scaleMode = 3;
            } else if (range > 0) {
                scaleMode = 4;
            }

            const ch2 = 262144;
            const ch3 = 524288;

            unpackLamaOutput(finalData, mask, image, strength, scaleMode, isOutNHWC);

            self.postMessage({
                type: 'complete',
                output: image
            }, [image.buffer]);

        } catch (error) {
            console.error("Worker inpainting failed:", error);
            self.postMessage({ type: 'error', error: error.message });
        }
    } else if (type === 'dispose') {
        if (session) {
            try {
                await session.release();
                wlog("Session released via dispose");
            } catch (e) {
                console.warn("Failed to release session:", e);
            }
            session = null;
            modelURL = '';
        }
        self.postMessage({ type: 'disposed' });
    }
};
