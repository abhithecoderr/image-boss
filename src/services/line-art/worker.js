/**
 * Line Art Worker using Informative Drawings AI Model
 * Model: x-Liola-x/informative-drawings-onnx
 */

import * as ort from "onnxruntime-web/webgpu";
import { getGPUConfig, createProgressReporter } from '../../core/worker-utils.js';

// Configure ONNX Runtime
// Using 1.20+ for best WebGPU support
const ORT_VERSION = "1.20.1";
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

const MODEL_URLS = {
  anime: "https://huggingface.co/x-Liola-x/informative-drawings-onnx/resolve/main/informative-drawings_anime_768x768.onnx",
  contour: "https://huggingface.co/x-Liola-x/informative-drawings-onnx/resolve/main/informative-drawings_contour_768x768.onnx"
};
const MODEL_SIZE = 768;

let session = null;
let currentVariant = null;
let currentDevice = "wasm";
let isInitializing = false;

async function fetchWithProgress(url, label, report, startWeight, endWeight) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${label}: ${response.statusText}`);

  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body.getReader();
  const chunks = [];
  const reportProgress = report(startWeight, endWeight, `Downloading ${label}...`);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;

    if (total) {
      reportProgress((loaded / total) * 100);
    }
  }

  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

async function initSession(variant = "anime", onProgress) {
  if (session && currentVariant === variant) return session;
  if (isInitializing) {
    while (isInitializing) await new Promise(r => setTimeout(r, 100));
    return session;
  }

  isInitializing = true;
  currentVariant = variant;
  const modelUrl = MODEL_URLS[variant] || MODEL_URLS.anime;
  const report = createProgressReporter(onProgress);

  try {
    const modelBuffer = await fetchWithProgress(modelUrl, `Line Art AI (${variant})`, report, 0.1, 0.8);

    const hw = await getGPUConfig();
    const useWebGPU = hw.supported;
    const executionProviders = useWebGPU ? ["webgpu", "wasm"] : ["wasm"];
    const deviceLabel = useWebGPU ? "WEBGPU" : "WASM";

    const sessionOptions = {
        executionProviders,
        graphOptimizationLevel: "all",
    };

    report(0.85, 0.85, `Initializing session (${deviceLabel})...`)(0);
    session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
    currentDevice = useWebGPU ? "webgpu" : "wasm";
    
    console.info(`[LineArt Worker] ✓ ${variant} model loaded (${deviceLabel})`);
    report(0.9, 0.9, "Ready")(0);
    return session;
  } catch (error) {
    console.error("[LineArt Worker] Initialization failed:", error);
    session = null;
    currentVariant = null;
    throw error;
  } finally {
    isInitializing = false;
  }
}

async function runInference(bitmap, options, onProgress) {
  const { aiVariant = 'anime', details = 75, outputStyle = 'natural' } = options;
  const s = await initSession(aiVariant, onProgress);

  const width = bitmap.width;
  const height = bitmap.height;

  // 1. Preprocessing
  const canvas = new OffscreenCanvas(MODEL_SIZE, MODEL_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height, 0, 0, MODEL_SIZE, MODEL_SIZE);
  const imageData = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;

  // Image to Tensor (BCHW, Normalized)
  const tensorData = new Float32Array(1 * 3 * MODEL_SIZE * MODEL_SIZE);
  for (let i = 0; i < MODEL_SIZE * MODEL_SIZE; i++) {
    tensorData[i] = imageData[i * 4] / 255.0; // R
    tensorData[MODEL_SIZE * MODEL_SIZE + i] = imageData[i * 4 + 1] / 255.0; // G
    tensorData[2 * MODEL_SIZE * MODEL_SIZE + i] = imageData[i * 4 + 2] / 255.0; // B
  }

  const tensor = new ort.Tensor("float32", tensorData, [1, 3, MODEL_SIZE, MODEL_SIZE]);

  // 2. Inference
  const inputs = { [session.inputNames[0]]: tensor };
  const outputs = await session.run(inputs);
  const output = outputs[session.outputNames[0]];

  // 3. Postprocessing
  const data = output.data;
  const outData = new Uint8ClampedArray(MODEL_SIZE * MODEL_SIZE * 4);
  
  // Details slider mapping: 0-100 -> 0-255 threshold
  // Higher details should mean more lines, so lower threshold?
  // Let's check original Sobel: threshold = Math.max(1, 200 - (details * 2));
  // In AI mode, if outputStyle is 'clean', we threshold the result.
  const thresholdValue = Math.max(1, 255 - (details * 2.5));

  for (let i = 0; i < MODEL_SIZE * MODEL_SIZE; i++) {
    let val = Math.round(data[i] * 255);
    
    if (outputStyle === 'clean') {
        // Model usually outputs dark for lines? Let's assume high value = clean background
        // Wait, Sobel: magnitude > threshold ? black : white
        // Informative drawings: output is usually lines.
        // Actually Informative Drawings output is closer to grayscale sketch.
        // If val > thresholdValue -> background (255), else line (0)
        val = val > (255 - thresholdValue) ? 255 : 0; 
    }

    outData[i * 4] = val;
    outData[i * 4 + 1] = val;
    outData[i * 4 + 2] = val;
    outData[i * 4 + 3] = 255;
  }

  const resultCanvas = new OffscreenCanvas(MODEL_SIZE, MODEL_SIZE);
  resultCanvas.getContext('2d').putImageData(new ImageData(outData, MODEL_SIZE, MODEL_SIZE), 0, 0);
  
  // Resize back to original if needed or just send the 768x768 and scale in UI
  // The system seems to favor sending ImageBitmap back.
  const resultBitmap = await createImageBitmap(resultCanvas);
  
  return {
    resultBitmap,
    width,
    height
  };
}

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    if (type === "process") {
      const { bitmap, options } = payload;
      const result = await runInference(bitmap, options, (progress, message) => {
        self.postMessage({ type: "progress", progress, message });
      });

      self.postMessage({
        type: "complete",
        result
      }, [result.resultBitmap]);
      
      bitmap.close();
    } else if (type === "dispose") {
      session = null;
      self.postMessage({ type: "disposed" });
    }
  } catch (error) {
    self.postMessage({ type: "error", error: error.message });
  }
};
