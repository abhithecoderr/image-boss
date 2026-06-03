/**
 * Direct ONNX Runtime Web worker for BiRefNet models.
 * Performance-optimized: reuses pre-processing and post-processing canvas contexts
 * and typed arrays to avoid garbage collection memory spikes.
 */

import * as ort from "onnxruntime-web/webgpu";
import { getGPUConfig, createProgressReporter } from "../../core/worker-utils.js";
import { BACKGROUND_REMOVAL_MODELS } from "../../config/models.js";
import { fetchWithProgress } from "../upscaling/helpers.js";

// Configure ONNX Runtime for stability
ort.env.wasm.numThreads = Math.min(4, self.navigator.hardwareConcurrency || 4);
ort.env.wasm.wasmPaths = "/onnx/";

let session = null;
let currentModelId = null;
let currentDevice = null;
let currentDtype = null;

// Global reuse cache to prevent memory/GPU texture allocation churn
let cachedPreprocessCanvas = null;
let cachedPreprocessCtx = null;
let cachedPostprocessCanvas = null;
let cachedPostprocessCtx = null;
let cachedTensorBuffer = null;
let cachedTensorBufferSize = 0;

function releaseSession() {
  if (session) {
    try {
      session.release?.();
    } catch (err) {
      console.warn("Failed to safely release InferenceSession:", err);
    }
    session = null;
    currentDevice = null;
    currentDtype = null;
    currentModelId = null;
  }
  // Fully clean up cached objects on dispose/eviction to prevent RAM/VRAM leak
  cachedPreprocessCanvas = null;
  cachedPreprocessCtx = null;
  cachedPostprocessCanvas = null;
  cachedPostprocessCtx = null;
  cachedTensorBuffer = null;
  cachedTensorBufferSize = 0;
}

async function getSession(modelId, onProgress) {
  if (session && currentModelId === modelId) return session;

  releaseSession();

  const report = createProgressReporter(onProgress);
  report(0.01, 0.05, "Initializing device configuration...")(0);

  const modelConfig = BACKGROUND_REMOVAL_MODELS[modelId];
  if (!modelConfig) {
    throw new Error(`Model configuration not found for: ${modelId}`);
  }

  const hw = await getGPUConfig();
  const device = hw.supported ? "webgpu" : "wasm";
  let dtype = modelConfig.default_dtype || "fp32";
  if (device === "webgpu" && dtype === "fp16" && !hw.fp16) {
    dtype = "fp32";
  }

  // Choose model variant:
  // - WebGPU: model_fp16.onnx (or model.onnx if fp16 is not supported)
  // - WASM (CPU): model_quantized.onnx (much smaller, lower RAM, faster CPU execution)
  let modelFile = "model.onnx";
  if (device === "webgpu") {
    modelFile = dtype === "fp16" ? "model_fp16.onnx" : "model.onnx";
  } else {
    modelFile = "model_quantized.onnx";
  }

  const modelUrl = `https://huggingface.co/${modelConfig.model_id}/resolve/main/onnx/${modelFile}`;

  let modelBuffer = await fetchWithProgress(
    modelUrl,
    `${modelConfig.model_id} (${device === "webgpu" ? dtype : "quantized"})`,
    report,
    0.05,
    0.7,
  );

  const deviceLabel = device.toUpperCase();
  report(0.7, 0.7, `Initializing ONNX session (${deviceLabel})...`)(0);

  const preferredProviders = device === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
  const sessionOptions = {
    executionProviders: preferredProviders,
    graphOptimizationLevel: "all",
  };

  try {
    session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
    // Explicitly release the JS ArrayBuffer reference immediately to avoid double memory allocation spikes
    modelBuffer = null;
    currentDevice = device;
    currentDtype = dtype;
  } catch (gpuError) {
    if (device === "webgpu") {
      console.warn("WebGPU Session initialization failed, falling back to WASM...", gpuError);
      report(0.75, 0.75, "WebGPU failed. Retrying on CPU (WASM) with quantized model...")(0);
      
      // Fetch quantized model for WASM fallback
      let fallbackBuffer = await fetchWithProgress(
        `https://huggingface.co/${modelConfig.model_id}/resolve/main/onnx/model_quantized.onnx`,
        `${modelConfig.model_id} (quantized)`,
        report,
        0.75,
        0.9,
      );

      sessionOptions.executionProviders = ["wasm"];
      session = await ort.InferenceSession.create(fallbackBuffer, sessionOptions);
      // Clean up fallback buffer copy immediately
      fallbackBuffer = null;
      currentDevice = "wasm";
      currentDtype = "quantized";
    } else {
      throw gpuError;
    }
  }

  currentModelId = modelId;
  report(0.92, 0.92, "Model ready")(0);
  return session;
}

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === "process") {
    try {
      const onProgress = (prog, msg) =>
        self.postMessage({ type: "progress", progress: prog, message: msg });
      const report = createProgressReporter(onProgress);

      const { bitmap, model: modelId } = payload;
      const modelConfig = BACKGROUND_REMOVAL_MODELS[modelId] || BACKGROUND_REMOVAL_MODELS["birefnet-lite"];
      const size = modelConfig.size || 512;

      const sess = await getSession(modelId, onProgress);

      report(0.93, 0.93, "Pre-processing input image...")(0);

      // Reuse pre-processing offscreen canvas
      if (!cachedPreprocessCanvas || cachedPreprocessCanvas.width !== size) {
        cachedPreprocessCanvas = new OffscreenCanvas(size, size);
        cachedPreprocessCtx = cachedPreprocessCanvas.getContext("2d", { willReadFrequently: true });
      }
      cachedPreprocessCtx.drawImage(bitmap, 0, 0, size, size);
      const imgData = cachedPreprocessCtx.getImageData(0, 0, size, size);
      const pixels = imgData.data;

      // Reuse Float32Array to feed input tensor to avoid allocating huge arrays per frame
      const totalPixels = size * size;
      const requiredBufferSize = 3 * totalPixels;
      if (!cachedTensorBuffer || cachedTensorBufferSize !== requiredBufferSize) {
        cachedTensorBuffer = new Float32Array(requiredBufferSize);
        cachedTensorBufferSize = requiredBufferSize;
      }

      const mean = [0.485, 0.456, 0.406];
      const std = [0.229, 0.224, 0.225];

      for (let i = 0; i < totalPixels; i++) {
        const pIdx = i * 4;
        cachedTensorBuffer[i] = (pixels[pIdx] / 255.0 - mean[0]) / std[0]; // R
        cachedTensorBuffer[totalPixels + i] = (pixels[pIdx + 1] / 255.0 - mean[1]) / std[1]; // G
        cachedTensorBuffer[2 * totalPixels + i] = (pixels[pIdx + 2] / 255.0 - mean[2]) / std[2]; // B
      }

      report(0.95, 0.95, `Running inference (${currentDevice.toUpperCase()})...`)(0);

      // Create input tensor (pointing directly to the pre-allocated buffer)
      const tensor = new ort.Tensor("float32", cachedTensorBuffer, [1, 3, size, size]);
      const results = await sess.run({ [sess.inputNames[0]]: tensor });
      const outputTensor = results[sess.outputNames[0]];
      const outputData = outputTensor.data;

      report(0.98, 0.98, "Post-processing mask...")(0);

      // Reuse post-processing offscreen canvas
      if (!cachedPostprocessCanvas || cachedPostprocessCanvas.width !== size) {
        cachedPostprocessCanvas = new OffscreenCanvas(size, size);
        cachedPostprocessCtx = cachedPostprocessCanvas.getContext("2d");
      }
      
      const outImgData = cachedPostprocessCtx.createImageData(size, size);
      const outPixels = outImgData.data;

      const isLogitOutput = modelId !== "ben2"; // BEN2 outputs probability maps, others output logits

      for (let i = 0; i < totalPixels; i++) {
        const val = outputData[i];
        let alpha;
        if (isLogitOutput) {
          // Fast sigmoid check: bypass Math.exp for extreme values
          if (val > 5) {
            alpha = 255;
          } else if (val < -5) {
            alpha = 0;
          } else {
            alpha = Math.round((1.0 / (1.0 + Math.exp(-val))) * 255.0);
          }
        } else {
          // BEN2 outputs direct probabilities in [0.0, 1.0]
          alpha = Math.round(Math.max(0.0, Math.min(1.0, val)) * 255.0);
        }
        const pIdx = i * 4;
        outPixels[pIdx + 3] = alpha; // Alpha channel is the mask
      }
      cachedPostprocessCtx.putImageData(outImgData, 0, 0);

      const maskBitmap = await createImageBitmap(cachedPostprocessCanvas);

      // Clean up input
      bitmap.close();

      report(1.0, 1.0, "Background removal completed")(100);

      self.postMessage(
        {
          type: "complete",
          result: {
            resultBitmap: maskBitmap,
            width: size,
            height: size,
          },
        },
        [maskBitmap],
      );
    } catch (err) {
      console.error("BiRefNet custom ORT worker error:", err);
      self.postMessage({
        type: "error",
        error: err.message || "Background removal failed",
      });
    }
  }

  if (type === "clear" || type === "dispose") {
    releaseSession();
    self.postMessage({ type: "complete" });
  }
};
