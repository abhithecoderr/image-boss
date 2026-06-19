/*
 * Main-thread coordinator for Background Removal. Manages canvas caching, options parsing, and worker jobs.
 */
import BackgroundRemovalWorker from "./worker.js?worker";
import { resizeCanvas, imageToCanvas } from "../../utils/canvas-utils.js";
import { workerRegistry } from "../../engine/worker-registry.js";
import { runWorkerJob } from "../../utils/worker-utils.js";
import { BACKGROUND_REMOVAL_MODELS } from "../../config/models.js";
import { applyMaskToCanvas } from "./helpers.js";
import { removeBackground, loadImage } from "../../api/birefnet.js";

const SERVICE_ID = "background-removal";

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, BackgroundRemovalWorker);
}

// Standard Process (BiRefNet & ISNet)
export async function process(sourceCanvas, options = {}, onProgress) {
  const modelId = options.model || "birefnet-lite";
  const method = options.method || "pipeline";
  const tier = options.tier || "free";

  if (tier === "paid") {
    // --- Cache hit: serve post-processing adjustments without re-calling the API ---
    const paidCache = sourceCanvas._bgRemovalCache || {};
    if (
      paidCache.sourceCanvas === sourceCanvas &&
      paidCache.maskBitmap &&
      paidCache.modelId === modelId &&
      paidCache.tier === "paid"
    ) {
      return applyMaskToCanvas(
        sourceCanvas,
        { resultBitmap: paidCache.maskBitmap },
        options,
      );
    }

    // --- Cache miss: call the paid Cloud API ---
    onProgress?.(0.1, "Converting image to payload...");
    const imageBlob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, "image/png"));

    onProgress?.(0.3, `Processing on Cloud API (${modelId})...`);
    try {
      // Send client model ID — server resolves the API tag and runtime
      const cutoutBlob = await removeBackground("/api", imageBlob, { model: modelId });

      onProgress?.(0.8, "Loading result image...");
      const resultImg = await loadImage(cutoutBlob);

      // Draw the cutout into a temporary canvas so we can extract the alpha mask as a bitmap
      const { canvas: cutoutCanvas } = imageToCanvas(resultImg);

      if (resultImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(resultImg.src);
      }

      // Capture the cutout as a reusable ImageBitmap — this IS the mask for post-processing
      const maskBitmap = await createImageBitmap(cutoutCanvas);

      // Dispose any previously cached bitmap for this canvas
      const oldCache = sourceCanvas._bgRemovalCache || {};
      if (oldCache.maskBitmap && oldCache.maskBitmap !== maskBitmap) {
        try { oldCache.maskBitmap.close(); } catch (_) {}
      }

      // Store in the same per-canvas cache structure used by the free tier
      sourceCanvas._bgRemovalCache = {
        sourceCanvas,
        modelId,
        method,
        tier: "paid",
        maskBitmap,
      };

      onProgress?.(1.0, "Background removal completed.");
      // Composite via applyMaskToCanvas so post-processing options are applied immediately
      return applyMaskToCanvas(sourceCanvas, { resultBitmap: maskBitmap }, options);
    } catch (err) {
      console.error(`[Background Removal Paid] Processing failed:`, err);
      throw err;
    }
  }

  // Check cache for post-processing adjustments (canvas-scoped to prevent memory leaks)
  const cache = sourceCanvas._bgRemovalCache || {};
  if (
    cache.sourceCanvas === sourceCanvas &&
    cache.maskBitmap &&
    cache.modelId === modelId &&
    cache.method === method &&
    cache.tier === tier
  ) {
    return applyMaskToCanvas(
      sourceCanvas,
      { resultBitmap: cache.maskBitmap },
      options,
    );
  }

  const w = getWorker();

  // Retrieve size directly from central models config.
  const modelCfg = BACKGROUND_REMOVAL_MODELS[modelId] || BACKGROUND_REMOVAL_MODELS['birefnet-lite'];
  const targetSize = modelCfg ? modelCfg.size : 512;
  const processedCanvas = resizeCanvas(sourceCanvas, targetSize);
  const originalWidth = sourceCanvas.width;
  const originalHeight = sourceCanvas.height;

  // Zero-copy transfer
  const bitmap = await createImageBitmap(processedCanvas);

  try {
    const result = await runWorkerJob(
      w,
      "process",
      {
        bitmap,
        originalWidth,
        originalHeight,
        model: modelId,
        method,
      },
      [bitmap],
      onProgress,
    );

    // Clean up old cache if it exists and is different from the new one
    const oldCache = sourceCanvas._bgRemovalCache || {};
    if (oldCache.maskBitmap && oldCache.maskBitmap !== result.resultBitmap) {
      oldCache.maskBitmap.close();
    }

    // Update canvas-scoped cache
    sourceCanvas._bgRemovalCache = {
      sourceCanvas,
      modelId,
      method,
      maskBitmap: result.resultBitmap,
      tier
    };

    return applyMaskToCanvas(sourceCanvas, result, options);
  } catch (err) {
    console.error(`[Background Removal] Processing failed:`, err);
    // Terminate worker thread on crash so it recreates on next call
    workerRegistry.terminate(SERVICE_ID);
    throw err;

  } finally {
    bitmap.close();
  }
}

/**
 * Clear worker memory
 */
export async function dispose(clearModels = false) {
  try {
    const w = getWorker();
    await runWorkerJob(w, "clear", { clearModels });
  } catch (_) {}
}

export default { process, dispose };
