import ESRGANWorker from './esrgan.worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';
import { runWorkerJob } from '../../core/worker-utils.js';
import { PAID_MODELS_CONFIG } from '../../config/models.js';
import { upscaleImage } from '../../api/esrgan.js';
import { loadImage } from '../../api/birefnet.js';

const SERVICE_ID_ESRGAN = 'upscaling-esrgan';

function getWorker(modelId) {
  return workerRegistry.getWorker(SERVICE_ID_ESRGAN, ESRGANWorker);
}

export async function process(sourceCanvas, options = {}, onProgress) {
  const modelId = options.modelId || 'esrgan';
  const tier = options.tier || 'free';

  if (tier === 'paid') {
    onProgress?.(0.1, "Converting image to payload...");
    const imageBlob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, 'image/png'));

    const paidModelCfg = PAID_MODELS_CONFIG[modelId];
    const apiModelTag = paidModelCfg ? paidModelCfg.api_model_tag : "esrgan";
    const apiDevice = paidModelCfg ? paidModelCfg.api_runtime : "gpu";

    onProgress?.(0.3, `Uploading to Cloud API (${apiModelTag})...`);
    try {
      const upscaledBlob = await upscaleImage('/api', imageBlob, {
        model: apiModelTag,
        device: apiDevice
      });

      onProgress?.(0.8, "Loading upscaled result...");
      const upscaledImg = await loadImage(upscaledBlob);

      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = upscaledImg.naturalWidth || upscaledImg.width;
      resultCanvas.height = upscaledImg.naturalHeight || upscaledImg.height;
      const ctx = resultCanvas.getContext('2d');
      ctx.drawImage(upscaledImg, 0, 0);

      if (upscaledImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(upscaledImg.src);
      }

      onProgress?.(1.0, `Upscaled to ${resultCanvas.width}x${resultCanvas.height}`);
      return resultCanvas;
    } catch (err) {
      console.error(`[ESRGAN Paid] Processing failed:`, err);
      throw err;
    }
  }

  const w = getWorker(modelId);

  // Zero-copy transfer
  const bitmap = await createImageBitmap(sourceCanvas);

  try {
    const result = await runWorkerJob(w, 'upscale', { bitmap, modelId, ...options }, [bitmap], onProgress);

    // Convert result ImageBitmap back to Canvas
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = result.width;
    resultCanvas.height = result.height;
    const ctx = resultCanvas.getContext('2d');
    ctx.drawImage(result, 0, 0);
    result.close(); // Clean up transferable

    onProgress?.(1, `Upscaled to ${resultCanvas.width}x${resultCanvas.height}`);
    return resultCanvas;
  } finally {
    bitmap.close();
  }
}

/**
 * Simplified refine routine (filters removed)
 */
export async function refine(options = {}) {
  // Safe no-op/pass-through since we removed filter configuration
  console.warn("Refinement is not supported after filter removal.");
  return null;
}

/**
 * Dispose worker and free resources
 */
export async function dispose() {
  workerRegistry.dispose(SERVICE_ID_ESRGAN);
}

export default { process, refine, dispose };
