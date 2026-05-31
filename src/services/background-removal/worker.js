import { pipeline, AutoModel, AutoProcessor, env, RawImage } from '@huggingface/transformers';
import { getGPUConfig, rawImageToBitmap, bitmapToRawImage, createProgressReporter } from '../../core/worker-utils.js';

import { BACKGROUND_REMOVAL_MODELS } from '../../config/models.js';

const DEBUG = false;
let cachedGPUConfig = null;

// v4: Remote model downloads are the default. allowLocalModels is still valid.
env.allowLocalModels = false;
env.useBrowserCache = true;

// Thread config - wrap in try/catch as path may change across v4 minor versions
try {
  env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency;
} catch (_) {}

if (env.backends?.onnx?.webgpu) {
  env.backends.onnx.webgpu.graphCapture = true;
}

// Cache for loaded models
const segmenters = {};

// ---------------------------------------------------------------------------
// Pipeline path — MODNet, InSPyReNet (standard image-segmentation task)
// ---------------------------------------------------------------------------

const PIPELINE_CONFIGS = BACKGROUND_REMOVAL_MODELS;


async function loadPipelineModel(modelId, onProgress, device, dtype) {
  const config = PIPELINE_CONFIGS[modelId];
  const { model_id, task, size } = config;

  const report = createProgressReporter(onProgress);
  report(0.05, 0.05, `Initializing ${modelId} (${device.toUpperCase()})...`)(0);

  const segmenter = await pipeline(task, model_id, {
    device,
    dtype,
    progress_callback: report(0.1, 0.5, `Downloading ${modelId}...`),
  });

  if (DEBUG) {
    console.info(`[Worker] ✓ ${modelId} loaded via pipeline (${device}, ${dtype})`);
  }
  return { segmenter, size, model_id };
}

// --- BiRefNet helpers ---


async function loadBiRefNet(modelId, onProgress, device, dtype) {
  const report = createProgressReporter(onProgress);
  report(0.05, 0.05, `Initializing BiRefNet Custom (${device.toUpperCase()}, ${dtype})...`)(0);

  const loadOpts = { device, dtype };

  const [biModel, biProcessor] = await Promise.all([
    AutoModel.from_pretrained(modelId, {
      ...loadOpts,
      progress_callback: report(0.1, 0.45, `Downloading ${modelId}...`),
    }),
    AutoProcessor.from_pretrained(modelId, {
      progress_callback: report(0.1, 0.45, `Downloading ${modelId} processor...`),
    }),
  ]);

  if (DEBUG) {
    console.info(`[Worker] ✓ ${modelId} loaded (${device}, ${dtype})`);
  }
  return { biModel, biProcessor };
}


async function runBiRefNet(biModel, biProcessor, image) {
  // BiRefNet expects pixel_values input via AutoProcessor
  const { pixel_values } = await biProcessor(image);

  // Custom I/O: input_image → output_image or logits (sigmoid → uint8 mask)
  const outputs = await biModel({ input_image: pixel_values });
  const output = outputs.output_image || outputs.logits;

  if (!output) {
    throw new Error(`BiRefNet output keys not found. Available keys: ${Object.keys(outputs).join(', ')}`);
  }

  // Convert to uint8 mask: sigmoid output if logits, multiply by 255, resize to original
  // Explicitly assign intermediate tensors to prevent GPU/WebGPU buffer memory leaks
  const outputSliced = output[0];
  
  // Auto-detect if sigmoid is already applied (ONNX models often bundle this activation)
  const data = outputSliced.data;
  let min = 0;
  let max = 0;
  if (data && data.length > 0) {
    min = data[0];
    max = data[0];
    const step = Math.max(1, Math.floor(data.length / 100)); // Sample 100 points for speed
    for (let i = 0; i < data.length; i += step) {
      const val = data[i];
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }
  const alreadySigmoid = min >= -0.05 && max <= 1.05;
  
  const sigmoidTensor = alreadySigmoid ? outputSliced : outputSliced.sigmoid();
  const mulTensor = sigmoidTensor.mul(255);
  const rawMaskTensor = mulTensor.to("uint8");
  const mask = await RawImage.fromTensor(rawMaskTensor);

  // --- PREVENT MEMORY LEAKS ---
  // Manually dispose of WebGPU buffers while keeping the standard JS RawImage
  if (pixel_values?.dispose) pixel_values.dispose();
  if (outputs.output_image?.dispose) outputs.output_image.dispose();
  if (outputs.logits?.dispose) outputs.logits.dispose();

  if (outputSliced?.dispose && !alreadySigmoid) outputSliced.dispose();
  if (sigmoidTensor?.dispose) sigmoidTensor.dispose();
  if (mulTensor?.dispose) mulTensor.dispose();
  if (rawMaskTensor?.dispose) rawMaskTensor.dispose();

  // ----------------------------

  // Resize mask back to original image dimensions
  const resizedMask = await mask.resize(image.width, image.height);

  // Apply mask to original image, creating transparent background
  image.putAlpha(resizedMask);
  return image;
}

// ---------------------------------------------------------------------------
// Unified loadModel entry point and Disposal Helpers
// ---------------------------------------------------------------------------

/**
 * Safely dispose of a loaded model's WebGPU/WASM and memory resources.
 */
async function disposeModel(m) {
  if (!m) return;
  try {
    if (m.segmenter) {
      if (m.segmenter.model?.dispose) await m.segmenter.model.dispose();
      if (m.segmenter.processor?.dispose) await m.segmenter.processor.dispose();
    }
    if (m.biModel?.dispose) await m.biModel.dispose();
    if (m.biProcessor?.dispose) await m.biProcessor.dispose();
  } catch (err) {
    console.warn(`[Worker] Error disposing model resource:`, err);
  }
}


async function loadModel(modelId, onProgress) {
  if (segmenters[modelId]) return segmenters[modelId];

  // To prevent 2.7GB+ RAM bloat, enforce a cache size of 1 active model.
  // Dispose of any previously loaded model before loading a new one.
  for (const id of Object.keys(segmenters)) {
    if (id !== modelId) {
      await disposeModel(segmenters[id]);
      delete segmenters[id];
      if (DEBUG) {
        console.info(`[Worker] Evicted model '${id}' from memory to save RAM.`);
      }
    }
  }

  const config = BACKGROUND_REMOVAL_MODELS[modelId] || BACKGROUND_REMOVAL_MODELS["modnet"];
  if (!cachedGPUConfig) {
    cachedGPUConfig = await getGPUConfig();
  }
  const hw = cachedGPUConfig;
  const device = hw.supported ? "webgpu" : "wasm";

  if (config.method === "custom") {
    // Custom logic (BiRefNet series)
    let dtype = config.default_dtype;
    if (device === "webgpu" && dtype === "fp16" && !hw.fp16) {
      dtype = "fp32";
    }
    const { biModel, biProcessor } = await loadBiRefNet(config.model_id, onProgress, device, dtype);

    segmenters[modelId] = { biModel, biProcessor, size: config.size, device, dtype, model_id: config.model_id };
  } else {
    // Pipeline logic (RMBG, BEN2, etc.)
    let dtype = config.default_dtype;
    if (device === "webgpu" && dtype === "fp16" && !hw.fp16) {
      dtype = "fp32";
    }
    const { segmenter, size, model_id } = await loadPipelineModel(modelId, onProgress, device, dtype);
    segmenters[modelId] = { segmenter, size, device, dtype, model_id };
  }

  return segmenters[modelId];
}


// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  try {
    const { model: modelId = "modnet" } = payload || {};

    if (type === "process") {
      const tStart = performance.now();
      const cached = await loadModel(
        modelId,
        (progress, message) => {
          self.postMessage({ type: "progress", progress, message });
        },
      );

      const { size, device, dtype, model_id } = cached;

      // Decode bitmap → RawImage using utility
      const tPre0 = performance.now();
      const image = await bitmapToRawImage(payload.bitmap);
      const tPre1 = performance.now();

      if (DEBUG) {
        console.info(
          `[Worker] ${modelId} run config: repo=${model_id}, device=${device}, dtype=${dtype}, ` +
            `input=${image.width}x${image.height}, targetSize=${size}`
        );
      }

      self.postMessage({ type: "progress", progress: 0.55, message: "Removing background..." });

      const config = BACKGROUND_REMOVAL_MODELS[modelId] || BACKGROUND_REMOVAL_MODELS["modnet"];
      const tInfer0 = performance.now();
      let outputRawImage;
      try {
        if (config.method === "custom") {
          // Custom logic (BiRefNet series)
          outputRawImage = await runBiRefNet(cached.biModel, cached.biProcessor, image);
        } else {
          // Standard pipeline handles compositing natively
          const res = await cached.segmenter(image, {
            size: { width: size, height: size }
          });
          outputRawImage = Array.isArray(res) ? res[0] : res;
          if (outputRawImage && !outputRawImage.data) {
            outputRawImage = outputRawImage.mask || outputRawImage.image || outputRawImage;
          }
          if (!outputRawImage || !outputRawImage.data) {
            throw new Error(
              `Pipeline returned an invalid image structure without pixel data. Keys: ${
                outputRawImage ? Object.keys(outputRawImage).join(', ') : 'null'
              }`
            );
          }
        }
      } catch (err) {
        if (payload?.bitmap?.close) payload.bitmap.close();
        console.error("[Worker] Inference failed:", err?.message || err);
        throw err;
      }
      const tInfer1 = performance.now();

      const tPost0 = performance.now();
      const finalBitmap = await rawImageToBitmap(outputRawImage);
      if (payload?.bitmap?.close) payload.bitmap.close();
      const tPost1 = performance.now();

      if (DEBUG) {
        console.info(
          `[Worker] ${modelId} timings (ms): pre=${(tPre1 - tPre0).toFixed(1)}, ` +
            `infer=${(tInfer1 - tInfer0).toFixed(1)}, post=${(tPost1 - tPost0).toFixed(1)}, ` +
            `total=${(tPost1 - tStart).toFixed(1)}`
        );
      }

      self.postMessage(
        {
          type: "complete",
          result: {
            resultBitmap: finalBitmap,
            width: finalBitmap.width,
            height: finalBitmap.height,
          },
        },
        [finalBitmap],
      );
    }

    if (type === "clear") {
      if (payload.clearModels) {
        for (const id of Object.keys(segmenters)) {
          await disposeModel(segmenters[id]);
          delete segmenters[id];
        }
      }
      self.postMessage({ type: "clear-complete" });
    }

    if (type === "dispose") {
      for (const id of Object.keys(segmenters)) {
        await disposeModel(segmenters[id]);
        delete segmenters[id];
      }
    }
  } catch (err) {
    console.error("Worker Error:", err);
    self.postMessage({ type: "error", error: err.message });
  }
};
