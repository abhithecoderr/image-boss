import BiRefNetORTWorker from "./birefnet-ort.worker.js?worker";
import { resizeCanvas } from "../../core/canvas-utils.js";
import { workerRegistry } from "../../core/worker-registry.js";
import { runWorkerJob } from "../../core/worker-utils.js";
import { BACKGROUND_REMOVAL_MODELS } from "../../config/models.js";
import { applyMaskToCanvas } from "./helpers.js";

const SERVICE_ID = "background-removal";

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, BiRefNetORTWorker);
}

// Standard Process (BiRefNet)
 
export async function process(sourceCanvas, options = {}, onProgress) {
  const modelId = options.model || "birefnet-lite";

  // Check cache for post-processing adjustments (canvas-scoped to prevent memory leaks)
  const cache = sourceCanvas._bgRemovalCache || {};
  if (
    cache.sourceCanvas === sourceCanvas &&
    cache.maskBitmap &&
    cache.modelId === modelId
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
      maskBitmap: result.resultBitmap,
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
