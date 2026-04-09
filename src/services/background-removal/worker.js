import { pipeline, AutoModel, AutoProcessor, env, RawImage } from "@huggingface/transformers";
import { getGPUConfig, rawImageToBitmap, bitmapToRawImage } from '../../core/worker-utils.js';

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

const PIPELINE_CONFIGS = {
  modnet: {
    model_id: "Xenova/modnet",
    task: "background-removal",
    default_dtype: "fp32",
    size: 512,
  },
  inspyrenet: {
    model_id: "OS-Software/InSPyReNet-SwinB-Plus-Ultra-ONNX",
    task: "background-removal",
    default_dtype: "fp16",
    size: 768,
  },
  inspyrenet_lite: {
    model_id: "TheGuy444/InSpyReNet-Res2Net50",
    task: "background-removal",
    default_dtype: "fp32",
    size: 384,
  },
};

async function loadPipelineModel(modelId, onProgress, device, dtype) {
  const config = PIPELINE_CONFIGS[modelId];
  const { model_id, task, size } = config;

  onProgress?.(0.05, `Initializing ${modelId} (${device.toUpperCase()})...`);

  const makeProgressCb = () => (p) => {
    if (p.status === "progress") {
      const pct = p.total ? ((p.loaded ?? 0) / p.total) * 100 : (p.progress ?? 0);
      onProgress?.(
        0.1 + (pct / 100) * 0.4,
        `Downloading ${modelId}... ${Math.round(pct)}%`,
      );
    }
  };

  const segmenter = await pipeline(task, model_id, {
    device,
    dtype,
    progress_callback: makeProgressCb(),
  });

  console.info(`[Worker] ✓ ${modelId} loaded via pipeline (${device}, ${dtype})`);
  return { segmenter, size, model_id };
}

// ---------------------------------------------------------------------------
// BiRefNet — dedicated AutoModel path
// onnx-community/BiRefNet-ONNX uses a non-standard input_image/output_image
// interface that is NOT compatible with the generic pipeline() API.
// It also supports fp16 and runs at 1024×1024.
// ---------------------------------------------------------------------------

const BIREFNET_MODEL_ID = "onnx-community/BiRefNet_512x512-ONNX";
const BIREFNET_SIZE = 384;

async function loadBiRefNet(onProgress, device, dtype) {
  onProgress?.(0.05, `Initializing BiRefNet (${device.toUpperCase()}, ${dtype})...`);

  const makeProgressCb = (phase) => (p) => {
    if (p.status === "progress") {
      const pct = p.total ? ((p.loaded ?? 0) / p.total) * 100 : (p.progress ?? 0);
      if (pct > 0) {
        onProgress?.(
          0.1 + (pct / 100) * 0.35,
          `Downloading BiRefNet ${phase}... ${Math.round(pct)}%`,
        );
      }
    }
  };

  const loadOpts = { device, dtype };

  const [biModel, biProcessor] = await Promise.all([
    AutoModel.from_pretrained(BIREFNET_MODEL_ID, {
      ...loadOpts,
      progress_callback: makeProgressCb("model"),
    }),
    AutoProcessor.from_pretrained(BIREFNET_MODEL_ID, {
      progress_callback: makeProgressCb("processor"),
    }),
  ]);

  console.info(`[Worker] ✓ BiRefNet loaded (${device}, ${dtype})`);
  return { biModel, biProcessor };
}

async function runBiRefNet(biModel, biProcessor, image) {
  // BiRefNet expects pixel_values input via AutoProcessor
  const { pixel_values } = await biProcessor(image);

  // Custom I/O: input_image → output_image (sigmoid → uint8 mask)
  const { output_image } = await biModel({ input_image: pixel_values });

  // Convert to uint8 mask: sigmoid output, multiply by 255, resize to original
  const rawMaskTensor = output_image[0].sigmoid().mul(255).to("uint8");
  const mask = await RawImage.fromTensor(rawMaskTensor);

  // --- PREVENT MEMORY LEAKS ---
  // Manually dispose of WebGPU buffers while keeping the standard JS RawImage
  if (pixel_values?.dispose) pixel_values.dispose();
  if (output_image?.dispose) output_image.dispose();
  if (rawMaskTensor?.dispose) rawMaskTensor.dispose();
  // ----------------------------

  // Resize mask back to original image dimensions
  const resizedMask = await mask.resize(image.width, image.height);
  
  // Apply mask to original image, creating transparent background
  image.putAlpha(resizedMask);
  return image;
}

// ---------------------------------------------------------------------------
// Unified loadModel entry point
// ---------------------------------------------------------------------------

async function loadModel(modelId, onProgress) {
  if (segmenters[modelId]) return segmenters[modelId];

  // To prevent 2.7GB+ RAM bloat, enforce a cache size of 1 active model.
  // Dispose of any previously loaded model before loading a new one.
  Object.keys(segmenters).forEach(id => {
    if (id !== modelId) {
      const m = segmenters[id];
      if (m.segmenter?.dispose) m.segmenter.dispose();
      if (m.biModel?.dispose) m.biModel.dispose();
      delete segmenters[id];
      console.info(`[Worker] Evicted model '${id}' from memory to save RAM.`);
    }
  });

  const hw = await getGPUConfig();
  const device = hw.supported ? "webgpu" : "wasm";

  if (modelId === "birefnet") {
    // BiRefNet: fp16 available if adapter supports it — this is the main perf lever
    const dtype = (device === "webgpu" && hw.fp16) ? "fp16" : "fp32";
    const { biModel, biProcessor } = await loadBiRefNet(onProgress, device, dtype);
    segmenters[modelId] = { biModel, biProcessor, size: BIREFNET_SIZE, device, dtype, model_id: BIREFNET_MODEL_ID };
  } else {
    const config = PIPELINE_CONFIGS[modelId] || PIPELINE_CONFIGS["modnet"];
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

      console.info(
        `[Worker] ${modelId} run config: repo=${model_id}, device=${device}, dtype=${dtype}, ` +
          `input=${image.width}x${image.height}, targetSize=${size}`
      );

      self.postMessage({ type: "progress", progress: 0.55, message: "Removing background..." });

      const tInfer0 = performance.now();
      let outputRawImage;
      try {
        if (modelId === "birefnet") {
          // BiRefNet returns composited RawImage directly
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

      console.info(
        `[Worker] ${modelId} timings (ms): pre=${(tPre1 - tPre0).toFixed(1)}, ` +
          `infer=${(tInfer1 - tInfer0).toFixed(1)}, post=${(tPost1 - tPost0).toFixed(1)}, ` +
          `total=${(tPost1 - tStart).toFixed(1)}`
      );

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
        Object.keys(segmenters).forEach(id => {
          const m = segmenters[id];
          if (m.segmenter?.dispose) m.segmenter.dispose();
          if (m.biModel?.dispose) m.biModel.dispose();
          delete segmenters[id];
        });
      }
      self.postMessage({ type: "clear-complete" });
    }
  } catch (err) {
    console.error("Worker Error:", err);
    self.postMessage({ type: "error", error: err.message });
  }
};
