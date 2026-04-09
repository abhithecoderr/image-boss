import Worker from './worker.js?worker';
import { resizeCanvas } from '../../core/canvas-utils.js';

let worker = null;
let lastProgressTime = 0;
const PROGRESS_THROTTLE = 100; // ms

function getWorker() {
  if (!worker) {
    worker = new Worker();
  }
  return worker;
}

/**
 * Standard Process (MODNet, InSPyReNet, BiRefNet)
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  return new Promise(async (resolve, reject) => {
    const w = getWorker();

    // Downsize to model-native resolution early to save RAM and transfer time.
    // These sizes should ideally match the target resolution of the models.
    const modelSizes = {
      'modnet': 512,
      'inspyrenet': 768,
      'birefnet': 512,
      'inspyrenet_lite': 384
    };

    const modelId = options.model;
    const targetSize = modelSizes[modelId] || 768;
    const processedCanvas = resizeCanvas(sourceCanvas, targetSize);
    const originalWidth = sourceCanvas.width;
    const originalHeight = sourceCanvas.height;

    // Zero-copy transfer
    const bitmap = await createImageBitmap(processedCanvas);

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
        resolve(applyMaskToCanvas(sourceCanvas, result));
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
        originalWidth,
        originalHeight,
        model: modelId,
      }
    }, [bitmap]);
  });
}

/**
 * Clear worker memory
 */
export async function clear(clearModels = false) {
    const w = getWorker();
    return new Promise((resolve) => {
        const handler = ({ data }) => {
            if (data.type === 'clear-complete') {
                w.removeEventListener('message', handler);
                resolve();
            }
        };
        w.addEventListener('message', handler);
        w.postMessage({ type: 'clear', payload: { clearModels } });
    });
}

/**
 * Apply 1-channel mask result to a source canvas using GPU scaling
 * Isolated state to prevent concurrency hazards.
 */
let cachedResultCanvas = null;
let cachedResultCtx = null;

function applyMaskToCanvas(sourceCanvas, maskResult) {
  if (!sourceCanvas) return null;
  const { resultBitmap } = maskResult;

  // 1. Create or reuse result canvas (Performance Tip: Reuse for stable memory)
  if (!cachedResultCanvas || cachedResultCanvas.width !== sourceCanvas.width || cachedResultCanvas.height !== sourceCanvas.height) {
    cachedResultCanvas = document.createElement('canvas');
    cachedResultCanvas.width = sourceCanvas.width;
    cachedResultCanvas.height = sourceCanvas.height;
    cachedResultCtx = cachedResultCanvas.getContext('2d');
  }

  // 2. Simple pass-through blitting
  cachedResultCtx.clearRect(0, 0, cachedResultCanvas.width, cachedResultCanvas.height);
  cachedResultCtx.drawImage(resultBitmap, 0, 0, cachedResultCanvas.width, cachedResultCanvas.height);

  // Free GPU memory
  resultBitmap.close();

  return cachedResultCanvas;
}

export default { process, clear };


