import { pipeline, env, RawImage } from '@huggingface/transformers';
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

/**
 * Safely dispose of a loaded model's WebGPU/WASM and memory resources.
 */
async function disposeModel(m) {
  if (!m) return;
  try {
    if (m.segmenter) {
      if (typeof m.segmenter.dispose === 'function') {
        await m.segmenter.dispose();
      } else {
        if (m.segmenter.model?.dispose) await m.segmenter.model.dispose();
        if (m.segmenter.processor?.dispose) await m.segmenter.processor.dispose();
      }
    }
  } catch (err) {
    console.warn(`[Worker] Error disposing model resource:`, err);
  }
}

async function loadModel(modelId, onProgress) {
  if (segmenters[modelId]) return segmenters[modelId];

  // To prevent RAM bloat, enforce a cache size of 1 active model.
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

  let dtype = config.default_dtype;
  if (device === "webgpu" && dtype === "fp16" && !hw.fp16) {
    dtype = "fp32";
  }
  const { segmenter, size, model_id } = await loadPipelineModel(modelId, onProgress, device, dtype);
  segmenters[modelId] = { segmenter, size, device, dtype, model_id };

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

      const tInfer0 = performance.now();
      let outputRawImage;
      try {
        // Standard pipeline handles compositing natively
        const res = await cached.segmenter(image, {
          size: { width: size, height: size }
        });
        outputRawImage = Array.isArray(res) ? res[0] : res;
        if (outputRawImage && !outputRawImage.data) {
          if (outputRawImage.image) {
            outputRawImage = outputRawImage.image;
          } else if (outputRawImage.mask) {
            const resizedMask = await outputRawImage.mask.resize(image.width, image.height);
            image.putAlpha(resizedMask);
            outputRawImage = image;
          }
        }

        if (outputRawImage && outputRawImage.channels === 1) {
          const resizedMask = await outputRawImage.resize(image.width, image.height);
          image.putAlpha(resizedMask);
          outputRawImage = image;
        }

        if (!outputRawImage || !outputRawImage.data) {
          throw new Error(
            `Pipeline returned an invalid image structure without pixel data. Keys: ${
              outputRawImage ? Object.keys(outputRawImage).join(', ') : 'null'
            }`
          );
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
