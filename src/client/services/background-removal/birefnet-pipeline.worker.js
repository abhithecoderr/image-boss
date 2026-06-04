/**
 * Transformers.js v4 pipeline Web Worker for BiRefNet models.
 */

import { pipeline, env } from "@huggingface/transformers";
import { getGPUConfig, createProgressReporter, bitmapToRawImage, rawImageToBitmap } from "../../core/worker-utils.js";
import { BACKGROUND_REMOVAL_MODELS } from "../../config/models.js";

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

function releasePipeline() {
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

async function getPipeline(modelId, onProgress) {
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
      // If it is a single output object (like when running background-removal with a single image), use it directly.
      const firstOutput = Array.isArray(output) ? output[0] : output;
      if (!firstOutput) {
        throw new Error("Pipeline execution failed: No output items returned.");
      }

      const maskRawImage = firstOutput.mask || firstOutput;
      if (!maskRawImage || !maskRawImage.data) {
        throw new Error("Pipeline execution failed: Output does not contain image data.");
      }
      
      const w = maskRawImage.width;
      const h = maskRawImage.height;
      const maskCanvas = new OffscreenCanvas(w, h);
      const maskCtx = maskCanvas.getContext("2d");
      const imgData = maskCtx.createImageData(w, h);
      const pixels = imgData.data;
      const maskData = maskRawImage.data;
      
      const channels = maskRawImage.channels || Math.round(maskData.length / (w * h));
      
      // Calculate min, max, and avg of the data for debugging
      let minVal = Infinity, maxVal = -Infinity, sumVal = 0;
      for (let i = 0; i < Math.min(maskData.length, 10000); i++) {
        const v = maskData[i];
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
        sumVal += v;
      }
      console.log(`[ISNet Debug] maskRawImage:`, {
        width: w,
        height: h,
        channels,
        dataType: maskData.constructor.name,
        length: maskData.length,
        min: minVal,
        max: maxVal,
        sample: Array.from(maskData.slice(0, 16))
      });

      const scale = (maxVal <= 1.0 && maxVal > 0.0) ? 255.0 : 1.0;

      if (channels === 4) {
        for (let i = 0; i < w * h; i++) {
          pixels[i * 4 + 3] = Math.round(maskData[i * 4 + 3] * scale); // Extract and scale alpha channel
        }
      } else if (channels === 1) {
        for (let i = 0; i < w * h; i++) {
          pixels[i * 4 + 3] = Math.round(maskData[i] * scale); // Scale single channel grayscale to alpha
        }
      } else {
        // RGB or other: take R channel (or average) and scale
        for (let i = 0; i < w * h; i++) {
          pixels[i * 4 + 3] = Math.round(maskData[i * channels] * scale);
        }
      }

      maskCtx.putImageData(imgData, 0, 0);
      const maskBitmap = await createImageBitmap(maskCanvas);

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
      console.error("BiRefNet pipeline worker error:", err);
      // Reset pipeline state on critical execution failure
      if (err.message.includes("lost") || err.message.includes("GPUBuffer") || err.message.includes("AbortError")) {
        releasePipeline();
      }
      self.postMessage({
        type: "error",
        error: err.message || "Background removal failed",
      });
    }
  }

  if (type === "clear" || type === "dispose") {
    releasePipeline();
    self.postMessage({ type: "complete" });
  }
};
