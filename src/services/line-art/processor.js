import Worker from './worker.js?worker';
import { applySobelFilter } from '../../core/canvas-utils.js';
import { createProgressReporter } from '../../core/worker-utils.js';
import { workerRegistry } from '../../core/worker-registry.js';

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
  const { method = 'sobel' } = options;

  if (method === 'sobel') {
    return processSobel(sourceCanvas, options, onProgress);
  } else {
    return processAI(sourceCanvas, options, onProgress);
  }
}

/**
 * Classic WebGL Sobel Filter
 */
async function processSobel(sourceCanvas, options, onProgress) {
  const { details = 75 } = options;
  const threshold = Math.max(1, 200 - (details * 2));
  const report = createProgressReporter(onProgress);

  report(0.2, 0.2, 'Extracting edges...')();

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);

  applySobelFilter(resultCanvas, threshold);
  report(1, 1, 'Complete')();

  return resultCanvas;
}

/**
 * AI-based Line Art (Informative Drawings)
 */
async function processAI(sourceCanvas, options, onProgress) {
  workerRegistry.activate(SERVICE_ID);
  const w = getWorker();
  let lastProgressTime = 0;
  const PROGRESS_THROTTLE = 100;

  const bitmap = await createImageBitmap(sourceCanvas);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener('message', messageHandler);
      w.removeEventListener('error', errorHandler);
      bitmap.close();
    };

    const messageHandler = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        const now = Date.now();
        if (now - lastProgressTime > PROGRESS_THROTTLE || progress === 1) {
            onProgress?.(progress, message);
            lastProgressTime = now;
        }
      } else if (type === 'complete') {
        cleanup();
        resolve(resultToCanvas(sourceCanvas, result));
      } else if (type === 'error') {
        cleanup();
        reject(new Error(error));
      }
    };

    const errorHandler = (err) => {
      cleanup();
      reject(new Error(err.message || 'Worker error'));
    };

    w.addEventListener('message', messageHandler);
    w.addEventListener('error', errorHandler);

    w.postMessage({
      type: 'process',
      payload: {
        bitmap,
        options
      }
    }, [bitmap]);
  });
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
