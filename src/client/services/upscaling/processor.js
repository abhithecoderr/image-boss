import ESRGANWorker from './esrgan.worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';
import { runWorkerJob } from '../../core/worker-utils.js';

const SERVICE_ID_ESRGAN = 'upscaling-esrgan';

function getWorker(modelId) {
  return workerRegistry.getWorker(SERVICE_ID_ESRGAN, ESRGANWorker);
}

export async function process(sourceCanvas, options = {}, onProgress) {
  const modelId = options.modelId || 'esrgan';
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
