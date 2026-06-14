/*
 * Background Web Worker running Transformers.js pipeline and ORT WebGPU/WASM model inference.
 */
import { pipeline, env } from "@huggingface/transformers";
import * as ort from "onnxruntime-web/webgpu";
import { getGPUConfig, createProgressReporter, bitmapToRawImage, fetchWithProgress, imageToTensor, configureOrt } from "../../core/worker-utils.js";
import { BACKGROUND_REMOVAL_MODELS } from "../../config/models.js";
import { createAlphaMaskFromRawImage, createAlphaMaskFromTensors } from "./helpers.js";

// Disable local model loading & set CDN WASM paths
env.allowLocalModels = false;
env.useWasmCache = false; // Disable buggy/redundant WASM preloader cache
if (env.backends?.onnx) {
  env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/';
  env.backends.onnx.wasm.numThreads = Math.min(4, self.navigator?.hardwareConcurrency || 4);
  if (!env.backends.onnx.webgpu) {
    env.backends.onnx.webgpu = {};
  }
  // Request dedicated GPU to avoid integrated GPU bugs
  env.backends.onnx.webgpu.powerPreference = "high-performance";
}

// Configure ONNX Runtime for stability
configureOrt(ort);

// ===========================================================================
// PIPELINE METHOD RUNNER (Transformers.js)
// ===========================================================================

let pipelineInstance = null;
let pipelineModelId = null;
let pipelineDevice = null;
let pipelineDtype = null;

export function releasePipeline() {
  if (pipelineInstance) {
    try {
      pipelineInstance.dispose?.();
    } catch (err) {
      console.warn("Failed to safely dispose pipeline:", err);
    }
    pipelineInstance = null;
    pipelineModelId = null;
    pipelineDevice = null;
    pipelineDtype = null;
  }
}

async function getPipeline(modelId, onProgress) {
  if (pipelineInstance && pipelineModelId === modelId) return pipelineInstance;

  releasePipeline();

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

  report(0.05, 0.05, `Loading model pipeline (${device.toUpperCase()})...`)(0);

  try {
    const task = modelConfig.task || "image-segmentation";
    pipelineInstance = await pipeline(task, modelConfig.model_id, {
      device,
      dtype,
      progress_callback: report(0.05, 0.9, `Downloading model (${device.toUpperCase()})...`),
    });

    pipelineModelId = modelId;
    pipelineDevice = device;
    pipelineDtype = dtype;
  } catch (error) {
    console.error("Pipeline initialization failed:", error);
    throw error;
  }

  report(0.92, 0.92, "Model ready")(0);
  return pipelineInstance;
}

async function runPipeline(payload, onProgress) {
  const report = createProgressReporter(onProgress);
  const { bitmap, model: modelId } = payload;
  const modelConfig = BACKGROUND_REMOVAL_MODELS[modelId] || BACKGROUND_REMOVAL_MODELS["birefnet-lite"];
  const size = modelConfig.size || 512;

  try {
    const pipe = await getPipeline(modelId, onProgress);

    report(0.93, 0.93, "Pre-processing input image...")(0);

    // Convert ImageBitmap to RawImage
    const rawImage = await bitmapToRawImage(bitmap);

    report(0.95, 0.95, `Running inference (${pipelineDevice.toUpperCase()})...`)(0);

    // Run pipeline
    const output = await pipe(rawImage);

    report(0.98, 0.98, "Post-processing mask...")(0);

    if (!output) {
      throw new Error("Pipeline execution failed: No output returned.");
    }

    const firstOutput = Array.isArray(output) ? output[0] : output;
    if (!firstOutput) {
      throw new Error("Pipeline execution failed: No output items returned.");
    }

    const maskRawImage = firstOutput.mask || firstOutput;
    if (!maskRawImage || !maskRawImage.data) {
      throw new Error("Pipeline execution failed: Output does not contain image data.");
    }

    const maskBitmap = await createAlphaMaskFromRawImage(maskRawImage);

    report(1.0, 1.0, "Background removal completed")(100);

    return {
      resultBitmap: maskBitmap,
      width: size,
      height: size,
      device: pipelineDevice,
    };
  } catch (err) {
    console.error("Pipeline execution failed:", err);
    if (err.message && (err.message.includes("lost") || err.message.includes("GPUBuffer") || err.message.includes("AbortError"))) {
      releasePipeline();
    }
    throw err;
  }
}

// ===========================================================================
// DIRECT ORT METHOD RUNNER (Custom Models)
// ===========================================================================

let ortSession = null;
let ortModelId = null;
let ortDevice = null;
let ortDtype = null;

let cachedPostprocessCanvas = null;
let cachedPostprocessCtx = null;

export function releaseOrt() {
  if (ortSession) {
    try {
      ortSession.release?.();
    } catch (err) {
      console.warn("Failed to safely release InferenceSession:", err);
    }
    ortSession = null;
    ortDevice = null;
    ortDtype = null;
    ortModelId = null;
  }
  cachedPostprocessCanvas = null;
  cachedPostprocessCtx = null;
}

async function getSession(modelId, onProgress) {
  if (ortSession && ortModelId === modelId) return ortSession;

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
    ortSession = await ort.InferenceSession.create(modelBuffer, sessionOptions);
    modelBuffer = null;
    ortDevice = device;
    ortDtype = dtype;
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
      ortSession = await ort.InferenceSession.create(fallbackBuffer, sessionOptions);
      fallbackBuffer = null;
      ortDevice = "wasm";
      ortDtype = modelConfig.model_url ? dtype : "quantized";
    } else {
      throw gpuError;
    }
  }

  ortModelId = modelId;
  report(0.92, 0.92, "Model ready")(0);
  return ortSession;
}

async function runOrt(payload, onProgress) {
  const report = createProgressReporter(onProgress);
  const { bitmap, model: modelId } = payload;
  const modelConfig = BACKGROUND_REMOVAL_MODELS[modelId] || BACKGROUND_REMOVAL_MODELS["birefnet-lite"];
  const size = modelConfig.size || 512;

  const sess = await getSession(modelId, onProgress);

  report(0.93, 0.93, "Pre-processing input image...")(0);

  const tensorData = await imageToTensor(bitmap, size, {
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    layout: 'NCHW',
    scale: 1.0 / 255.0
  });

  report(0.95, 0.95, `Running inference (${ortDevice.toUpperCase()})...`)(0);

  // Create input tensor
  const tensor = new ort.Tensor("float32", tensorData, [1, 3, size, size]);
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
    device: ortDevice,
  };
}

// ===========================================================================
// MAIN WORKER ROUTER
// ===========================================================================

let currentMethod = null; // 'pipeline' | 'custom'

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === "process") {
    try {
      const onProgress = (prog, msg) =>
        self.postMessage({ type: "progress", progress: prog, message: msg });

      const { bitmap, model: modelId } = payload;
      const modelConfig = BACKGROUND_REMOVAL_MODELS[modelId] || BACKGROUND_REMOVAL_MODELS["birefnet-lite"];
      
      let method = payload.method || "custom";
      if (modelConfig && modelConfig.method && modelConfig.method !== "hybrid") {
        method = modelConfig.method;
      }

      // Memory release on approach switch
      if (currentMethod && currentMethod !== method) {
        console.log(`[Worker] Switching approach from ${currentMethod} to ${method}. Disposing previous runner memory...`);
        if (currentMethod === "pipeline") releasePipeline();
        if (currentMethod === "custom") releaseOrt();
      }
      currentMethod = method;

      let result;
      if (method === "pipeline") {
        result = await runPipeline(payload, onProgress);
      } else {
        result = await runOrt(payload, onProgress);
      }

      // Clean up input bitmap to avoid leak in main thread / worker
      bitmap.close();

      self.postMessage(
        {
          type: "complete",
          result: {
            resultBitmap: result.resultBitmap,
            width: result.width,
            height: result.height,
            info: {
              device: result.device,
              method: method,
            }
          },
        },
        [result.resultBitmap],
      );
    } catch (err) {
      console.error("[Background Removal Worker] Processing failed:", err);
      self.postMessage({
        type: "error",
        error: err.message || "Background removal execution failed",
      });
    }
  }

  if (type === "clear" || type === "dispose") {
    console.log("[Worker] Evicting background removal models and caches from worker...");
    releasePipeline();
    releaseOrt();
    currentMethod = null;
    self.postMessage({ type: "complete" });
  }
};
