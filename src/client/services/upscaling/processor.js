import ESRGANWorker from './worker.js?worker';
import { workerRegistry } from '../../engine/worker-registry.js';
import { runWorkerJob } from '../../utils/worker-utils.js';
import { imageToCanvas } from '../../utils/canvas-utils.js';
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

    onProgress?.(0.3, `Uploading to Cloud API (${modelId})...`);
    try {
      // Send client model ID — server resolves the API tag and runtime
      const upscaledBlob = await upscaleImage('/api', imageBlob, {
        model: modelId
      });

      onProgress?.(0.8, "Loading upscaled result...");
      const upscaledImg = await loadImage(upscaledBlob);

      const { canvas: resultCanvas } = imageToCanvas(upscaledImg);

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
    const { canvas: resultCanvas } = imageToCanvas(result);
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
