/**
 * magic-erase/worker.js
 * handles LaMa inpainting inference in a background thread.
 */

import * as ort from 'onnxruntime-web';
import { createProgressReporter } from '../../core/worker-utils.js';

let session = null;
let modelURL = '';
let lastSessionOptions = null;

const DEBUG = false;

// Configure ORT
// Note: We use the version from package.json for the bundle, 
// but we set wasmPaths to a consistent CDN to avoid local wasm resolution issues in workers.
const ORT_VERSION = '1.20.1'; 
ort.env.wasm.numThreads = self.crossOriginIsolated ? 4 : 1;
ort.env.wasm.simd = true;
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
ort.env.debug = false;

try {
    ort.env.logLevel = 'error';
} catch (e) {
    console.warn('Failed to set ort.env.logLevel, continuing without it.', e);
}

function wlog(...args) {
    if (!DEBUG) return;
    const ts = new Date().toISOString();
    console.log(`[MagicErase Worker ${ts}]`, ...args);
}

function getMeta(meta, name, idx) {
    if (!meta) return undefined;
    if (Array.isArray(meta)) return meta[idx];
    if (typeof meta === 'object' && meta !== null) return meta[name];
    return undefined;
}

function getDims(meta) {
    if (!meta) return undefined;
    if (Array.isArray(meta.dimensions)) return meta.dimensions;
    if (Array.isArray(meta.dims)) return meta.dims;
    return undefined;
}

function detectLayout(dims) {
    if (dims && dims.length === 4) {
        if (dims[3] === 3) return 'NHWC';
        if (dims[1] === 3) return 'NCHW';
    }
    return 'NCHW';
}

function normalizeDims(dims, channels) {
    if (!dims || !dims.length) return [1, channels, 512, 512];
    const fixed = dims.slice();
    const layout = detectLayout(dims);
    for (let i = 0; i < fixed.length; i++) {
        if (fixed[i] === -1 || fixed[i] === null || typeof fixed[i] === 'undefined') {
            if (i === 0) fixed[i] = 1;
            else if (layout === 'NCHW' && i === 1) fixed[i] = channels;
            else if (layout === 'NHWC' && i === 3) fixed[i] = channels;
            else fixed[i] = 512;
        }
    }
    return fixed;
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

        // Intercept with Cache API
        report(0, 0, 'Checking cache...')();
        let modelBuffer;
        try {
            const cache = await caches.open('lama-model-cache-v1');
            let response = await cache.match(modelURL);
            if (!response) {
                wlog("Model not found in cache. Downloading from network...");
                response = await fetch(modelURL);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const contentLength = response.headers.get('Content-Length');
                const total = contentLength ? parseInt(contentLength, 10) : 0;
                let loaded = 0;
                
                const reader = response.clone().body.getReader();
                const reportDownload = report(0.1, 0.7, 'Downloading model (~50MB)...');
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    loaded += value.length;
                    if (total) reportDownload((loaded / total) * 100);
                }

                await cache.put(modelURL, response.clone());
            } else {
                wlog("Model instantly loaded from browser Cache API.");
            }
            modelBuffer = await response.arrayBuffer();
        } catch (cacheErr) {
            wlog("Cache API failed, falling back to direct ORT load", cacheErr);
            modelBuffer = modelURL;
        }

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
            const { image, mask } = payload; 

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

            for (let i = 0; i < 512 * 512; i++) {
                const r = image[i * 4] / 255.0;
                const g = image[i * 4 + 1] / 255.0;
                const b = image[i * 4 + 2] / 255.0;

                if (isNHWC) {
                    imageTensorData[i * 3] = r;
                    imageTensorData[i * 3 + 1] = g;
                    imageTensorData[i * 3 + 2] = b;
                } else {
                    imageTensorData[i] = r;
                    imageTensorData[i + 512 * 512] = g;
                    imageTensorData[i + 1024 * 512] = b;
                }

                maskTensorData[i] = mask[i * 4] > 128 ? 1.0 : 0.0;
            }

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

            let finalData = outputTensor.data;
            if (isOutNHWC) {
                const reshaped = new Float32Array(3 * 512 * 512);
                for (let i = 0; i < 512 * 512; i++) {
                    reshaped[i] = finalData[i * 3];
                    reshaped[i + 512 * 512] = finalData[i * 3 + 1];
                    reshaped[i + 1024 * 512] = finalData[i * 3 + 2];
                }
                finalData = reshaped;
            }

            self.postMessage({
                type: 'complete',
                output: finalData
            }, [finalData.buffer]);

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
