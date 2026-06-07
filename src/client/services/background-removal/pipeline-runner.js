import { pipeline, env } from "@huggingface/transformers";
import { getGPUConfig, createProgressReporter, bitmapToRawImage } from "../../core/worker-utils.js";
import { BACKGROUND_REMOVAL_MODELS } from "../../config/models.js";
import { createAlphaMaskFromRawImage } from "./worker-helpers.js";

// Disable local model loading
env.allowLocalModels = false;

if (env.backends?.onnx) {
  if (!env.backends.onnx.webgpu) {
    env.backends.onnx.webgpu = {};
  }
  // Request dedicated GPU to avoid integrated GPU bugs
  env.backends.onnx.webgpu.powerPreference = "high-performance";
}

let pipe = null;
let currentModelId = null;
let currentDevice = null;
let currentDtype = null;

export function releasePipeline() {
  if (pipe) {
    try {
      pipe.dispose?.();
    } catch (err) {
      console.warn("Failed to safely dispose pipeline:", err);
    }
    pipe = null;
    currentModelId = null;
    currentDevice = null;
    currentDtype = null;
  }
}

export async function getPipeline(modelId, onProgress) {
  if (pipe && currentModelId === modelId) return pipe;

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
    pipe = await pipeline(task, modelConfig.model_id, {
      device,
      dtype,
      progress_callback: report(0.05, 0.9, `Downloading model (${device.toUpperCase()})...`),
    });

    currentModelId = modelId;
    currentDevice = device;
    currentDtype = dtype;
  } catch (error) {
    console.error("Pipeline initialization failed:", error);
    throw error;
  }

  report(0.92, 0.92, "Model ready")(0);
  return pipe;
}

export async function runPipeline(payload, onProgress) {
  const report = createProgressReporter(onProgress);
  const { bitmap, model: modelId } = payload;
  const modelConfig = BACKGROUND_REMOVAL_MODELS[modelId] || BACKGROUND_REMOVAL_MODELS["birefnet-lite"];
  const size = modelConfig.size || 512;

  try {
    const pipelineInstance = await getPipeline(modelId, onProgress);

    report(0.93, 0.93, "Pre-processing input image...")(0);

    // Convert ImageBitmap to RawImage
    const rawImage = await bitmapToRawImage(bitmap);

    report(0.95, 0.95, `Running inference (${currentDevice.toUpperCase()})...`)(0);

    // Run pipeline
    const output = await pipelineInstance(rawImage);

    report(0.98, 0.98, "Post-processing mask...")(0);

    if (!output) {
      throw new Error("Pipeline execution failed: No output returned.");
    }

    // If output is an array (like in image-segmentation), grab the first item.
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
      device: currentDevice,
    };
  } catch (err) {
    console.error("Pipeline execution failed:", err);
    if (err.message && (err.message.includes("lost") || err.message.includes("GPUBuffer") || err.message.includes("AbortError"))) {
      releasePipeline();
    }
    throw err;
  }
}
