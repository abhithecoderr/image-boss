/**
 * magic-erase.worker.js
 * handles LaMa inpainting inference in a background thread.
 */

// Import ONNX Runtime from CDN (latest stable)
importScripts("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.1/dist/ort.all.min.js");

let session = null;
let modelURL = '';
let lastSessionOptions = null;

const DEBUG = false;

// Configure ORT
const hwThreads = (self.navigator && self.navigator.hardwareConcurrency) ? self.navigator.hardwareConcurrency : 1;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, Math.max(1, Math.floor(hwThreads / 2))) : 1;
ort.env.wasm.simd = true;
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.1/dist/';
ort.env.debug = false;
try {
    // ort.env.logLevel expects a string in recent ORT Web builds
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
    // Replace dynamic dims with concrete values for this app
    // Expected sizes: N=1, C=channels, H=W=512
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

function buildFreeDimensionOverrides(session) {
    const overrides = {};
    if (!session || !session.inputNames || !session.inputMetadata) return overrides;

    session.inputNames.forEach((name, idx) => {
        const meta = getMeta(session.inputMetadata, name, idx);
        const dims = getDims(meta);
        if (!Array.isArray(dims)) return;

        const layout = detectLayout(dims);
        const isImage = dims.includes(3) || name.toLowerCase().includes('image');
        const channels = isImage ? 3 : 1;

        dims.forEach((d, i) => {
            if (typeof d !== 'string') return;
            let value;
            if (i === 0) value = 1;
            else if (layout === 'NCHW' && i === 1) value = channels;
            else if (layout === 'NHWC' && i === 3) value = channels;
            else value = 512;

            if (overrides[d] && overrides[d] !== value) {
                wlog('Free dimension override conflict', { dim: d, existing: overrides[d], next: value });
                return;
            }
            overrides[d] = value;
        });
    });

    return overrides;
}

function buildSessionOptions(executionProviders, freeDimensionOverrides) {
    const options = {
        executionProviders,
        // Downgraded from 'all' to 'basic' to significantly speed up WASM initialization
        graphOptimizationLevel: 'basic'
    };
    if (freeDimensionOverrides && Object.keys(freeDimensionOverrides).length > 0) {
        options.freeDimensionOverrides = freeDimensionOverrides;
    }
    return options;
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
    
    // Note: The LaMa model uses Fast Fourier Convolutions (FFC). The ONNX WebGPU backend in browsers
    // currently cannot compile these specific graph operations without crashing over tensor broadcast mismatches.
    // For this specific model, we must force 'wasm' (CPU) to maintain functionality.
    const providers = ['wasm'];
    const primaryProvider = 'wasm';

    try {
        wlog("Attempting to load session", { providers, modelURL });
        lastSessionOptions = buildSessionOptions(providers);

        // Intercept with Cache API to prevent massive redundant downloads
        self.postMessage({ type: 'init-status', provider: primaryProvider, payload: { message: 'Checking cache...' } });
        let modelBuffer;
        try {
            const cache = await caches.open('lama-model-cache-v1');
            let response = await cache.match(modelURL);
            if (!response) {
                wlog("Model not found in cache. Downloading from network...");
                self.postMessage({ type: 'init-status', provider: primaryProvider, payload: { message: 'Downloading model (~50MB)...' } });
                response = await fetch(modelURL);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                await cache.put(modelURL, response.clone());
            } else {
                wlog("Model instantly loaded from browser Cache API.");
            }
            modelBuffer = await response.arrayBuffer();
        } catch (cacheErr) {
            wlog("Cache API failed, falling back to direct ORT load", cacheErr);
            // Fallback just passes the URL to ORT
            modelBuffer = modelURL;
        }

        self.postMessage({ type: 'init-status', provider: primaryProvider, payload: { message: 'Compiling ONNX WebAssembly Graph...' } });
        session = await ort.InferenceSession.create(modelBuffer, lastSessionOptions);
        
        let actualProvider = session.handler ? session.handler.constructor.name : primaryProvider;
        wlog("Session loaded", { provider: actualProvider });
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

            // Log model metadata for diagnostics
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
            const { image, mask } = payload; // Uint8ClampedArray or Uint8Array
            wlog('Inpaint request', { imageBytes: image.length, maskBytes: mask.length });

            // --- DYNAMIC INPUT MAPPING ---
            // Find which input is image and which is mask by looking at channels
            const imageKey = session.inputNames.find(n => {
                const idx = session.inputNames.indexOf(n);
                const dims = getDims(getMeta(session.inputMetadata, n, idx));
                return Array.isArray(dims) && dims.includes(3); // Image has 3 channels
            }) || session.inputNames[0];

            const maskKey = session.inputNames.find(n => {
                const idx = session.inputNames.indexOf(n);
                const dims = getDims(getMeta(session.inputMetadata, n, idx));
                return n !== imageKey && (Array.isArray(dims) && (dims.includes(1) || dims.length === 4));
            }) || session.inputNames[1];

            wlog(`Mapping inputs: image -> "${imageKey}", mask -> "${maskKey}"`);

            const imageIdx = session.inputNames.indexOf(imageKey);
            const maskIdx = session.inputNames.indexOf(maskKey);
            const imgShape = normalizeDims(getDims(getMeta(session.inputMetadata, imageKey, imageIdx)), 3);
            const maskShape = normalizeDims(getDims(getMeta(session.inputMetadata, maskKey, maskIdx)), 1);
            const inputLayout = detectLayout(imgShape);
            const isNHWC = inputLayout === 'NHWC';
            wlog('Input mapping', { imageKey, maskKey, imgShape, maskShape, layout: inputLayout });

            if (!self._lamaImageTensorData || self._lamaImageTensorData.length !== 3 * 512 * 512) {
                self._lamaImageTensorData = new Float32Array(3 * 512 * 512);
            }
            if (!self._lamaMaskTensorData || self._lamaMaskTensorData.length !== 512 * 512) {
                self._lamaMaskTensorData = new Float32Array(512 * 512);
            }
            const imageTensorData = self._lamaImageTensorData;
            const maskTensorData = self._lamaMaskTensorData;

            for (let i = 0; i < 512 * 512; i++) {
                // LaMa fp32 expects inputs in [0, 1]
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

            const tRun0 = performance.now();
            const results = await session.run(feeds);
            const tRun1 = performance.now();
            wlog('Inference complete', { ms: (tRun1 - tRun0).toFixed(2) });

            const outputName = session.outputNames[0];
            const outputTensor = results[outputName];
            const outShape = outputTensor.dims;
            const outputLayout = detectLayout(outShape);
            const isOutNHWC = outputLayout === 'NHWC';

            wlog('Output', { outputName, outShape, layout: outputLayout, dataType: outputTensor.type });

            // Always convert back to NCHW-style flat array for easier handling in main thread
            // or just send the raw data if the main thread can handle both.
            // Let's normalize it to a predictable NCHW-like format for the main thread's channel reading.
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
            const t1 = performance.now();
            wlog('Inpaint done', { totalMs: (t1 - t0).toFixed(2), outputLength: finalData.length });

        } catch (error) {
            console.error("Worker inpainting failed:", error);
            self.postMessage({ type: 'error', error: error.message });
        }
    }
};
