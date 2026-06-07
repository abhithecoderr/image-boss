import * as ort from "onnxruntime-web/webgpu";
import { getGPUConfig, createProgressReporter } from "../../core/worker-utils.js";
import { BACKGROUND_REMOVAL_MODELS } from "../../config/models.js";
import { fetchWithProgress } from "../upscaling/helpers.js";
import { createAlphaMaskFromTensors } from "./worker-helpers.js";

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

export function releaseOrt() {
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

export async function getSession(modelId, onProgress) {
  if (session && currentModelId === modelId) return session;

  releaseOrt();

  const report = createProgressReporter(onProgress);
  report(0.01, 0.05, "Initializing device configuration...")(0);

  const modelConfig = BACKGROUND_REMOVAL_MODELS[modelId];
  if (!modelConfig) {
    throw new Error(`Model configuration not found for: ${modelId}`);
  }

  const hw = await getGPUConfig();
  let device = hw.supported ? "webgpu" : "wasm";
  if (modelConfig.device === "wasm") {
    device = "wasm";
  }
  let dtype = modelConfig.default_dtype || "fp32";
  if (device === "webgpu" && dtype === "fp16" && !hw.fp16) {
    dtype = "fp32";
  }

  // Choose model variant:
  // - WebGPU: model_fp16.onnx (or model.onnx if fp16 is not supported)
  // - WASM (CPU): model_quantized.onnx (much smaller, lower RAM, faster CPU execution)
  let modelUrl = modelConfig.model_url;
  if (!modelUrl) {
    let modelFile = "model.onnx";
    if (device === "webgpu") {
      modelFile = dtype === "fp16" ? "model_fp16.onnx" : "model.onnx";
    } else {
      modelFile = "model_quantized.onnx";
    }
    modelUrl = `https://huggingface.co/${modelConfig.model_id}/resolve/main/onnx/${modelFile}`;
  }

  let modelBuffer = await fetchWithProgress(
    modelUrl,
    modelConfig.model_url ? `${modelId} (custom)` : `${modelConfig.model_id} (${device === "webgpu" ? dtype : "quantized"})`,
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
    modelBuffer = null;
    currentDevice = device;
    currentDtype = dtype;
  } catch (gpuError) {
    if (device === "webgpu") {
      console.warn("WebGPU Session initialization failed, falling back to WASM...", gpuError);
      report(0.75, 0.75, "WebGPU failed. Retrying on CPU (WASM)...")(0);
      
      const fallbackUrl = modelConfig.model_url || `https://huggingface.co/${modelConfig.model_id}/resolve/main/onnx/model_quantized.onnx`;
      let fallbackBuffer = await fetchWithProgress(
        fallbackUrl,
        modelConfig.model_url ? `${modelId} (custom)` : `${modelConfig.model_id} (quantized)`,
        report,
        0.75,
        0.9,
      );

      sessionOptions.executionProviders = ["wasm"];
      session = await ort.InferenceSession.create(fallbackBuffer, sessionOptions);
      fallbackBuffer = null;
      currentDevice = "wasm";
      currentDtype = modelConfig.model_url ? dtype : "quantized";
    } else {
      throw gpuError;
    }
  }

  currentModelId = modelId;
  report(0.92, 0.92, "Model ready")(0);
  return session;
}

export async function runOrt(payload, onProgress) {
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

  // Reuse Float32Array to feed input tensor
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

  const outputType = modelConfig.output_type || (modelId === "ben2" ? "probability" : "logit");

  const maskBitmap = await createAlphaMaskFromTensors(
    outputData,
    size,
    outputType,
    cachedPostprocessCanvas,
    cachedPostprocessCtx
  );

  report(1.0, 1.0, "Background removal completed")(100);

  return {
    resultBitmap: maskBitmap,
    width: size,
    height: size,
    device: currentDevice,
  };
}
