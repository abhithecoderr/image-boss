import Worker from './worker.js?worker';
import { createProgressReporter, runWorkerJob } from '../../utils/worker-utils.js';
import { workerRegistry } from '../../engine/worker-registry.js';

const SERVICE_ID = 'line-art';

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, Worker);
}

/**
 * Process image to extract line art
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {HTMLCanvasElement} Result canvas
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  return processAI(sourceCanvas, options, onProgress);
}

/**
 * AI-based Line Art (Informative Drawings)
 */
async function processAI(sourceCanvas, options, onProgress) {
  const w = getWorker();
  const bitmap = await createImageBitmap(sourceCanvas);

  try {
    const result = await runWorkerJob(w, 'process', { bitmap, options }, [bitmap], onProgress);
    return resultToCanvas(sourceCanvas, result);
  } finally {
    bitmap.close();
  }
}

/**
 * Helper to convert worker result bitmap back to a scaled canvas
 */
function resultToCanvas(sourceCanvas, result) {
  const { resultBitmap } = result;
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext('2d');

  // Draw and scale AI result back to original size
  ctx.drawImage(resultBitmap, 0, 0, resultCanvas.width, resultCanvas.height);
  resultBitmap.close();

  return resultCanvas;
}

export default { process };
