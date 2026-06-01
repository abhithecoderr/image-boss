import Worker from './worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';
import { runWorkerJob } from '../../core/worker-utils.js';

const SERVICE_ID = 'upscaling';

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, Worker);
}

/**
 * Upscale image by 2x using UpscalerJS in a Worker
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const w = getWorker();

  // Zero-copy transfer
  const bitmap = await createImageBitmap(sourceCanvas);

  try {
    const result = await runWorkerJob(w, 'upscale', { bitmap, ...options }, [bitmap], onProgress);

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
 * Update upscaling filters without re-running AI tiling
 */
export async function refine(options = {}) {
  const w = getWorker();
  const result = await runWorkerJob(w, 'refine', options);

  // Convert result ImageBitmap back to Canvas
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = result.width;
  resultCanvas.height = result.height;
  const ctx = resultCanvas.getContext('2d');
  ctx.drawImage(result, 0, 0);
  result.close();

  return resultCanvas;
}

/**
 * Dispose worker and free resources
 */
export async function dispose() {
  workerRegistry.dispose(SERVICE_ID);
}

export default { process, refine, dispose };
