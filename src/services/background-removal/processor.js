/**
 * Background Removal Processor
 * Resizes image on main thread for optimal performance
 */

import Worker from './worker.js?worker';
import { resizeCanvas } from '../../core/canvas-utils.js';

let worker = null;
let lastProgressTime = 0;
let lastProcessedCanvas = null;
const PROGRESS_THROTTLE = 100; // ms

function getWorker() {
  if (!worker) {
    worker = new Worker();
  }
  return worker;
}

/**
 * Encode an image for SAM 2 Interactive selection
 */
export async function encode(sourceCanvas, onProgress) {
  return new Promise(async (resolve, reject) => {
    const w = getWorker();

    // Zero-copy transfer: Create ImageBitmap and send as transferable
    const bitmap = await createImageBitmap(sourceCanvas);

    const messageHandler = ({ data }) => {
      const { type, progress, message, error } = data;
      if (type === 'progress') {
        onProgress?.(progress, message);
      } else if (type === 'encode-complete') {
        w.removeEventListener('message', messageHandler);
        resolve();
      } else if (type === 'error') {
        w.removeEventListener('message', messageHandler);
        reject(new Error(error));
      }
    };

    w.addEventListener('message', messageHandler);
    w.addEventListener('error', (err) => reject(new Error(err.message)), { once: true });

    w.postMessage({ type: 'encode', payload: { bitmap } }, [bitmap]);
  });
}

/**
 * Predict a mask from a set of points and labels (Unified Refinement)
 */
export async function predict(points, labels) {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    const handler = ({ data }) => {
      if (type === 'complete') {
        resolve(applyMaskToCanvas(lastProcessedCanvas, result));
      } else if (type === 'error') {
        reject(new Error(error));
      }
    };

    w.addEventListener('message', handler, { once: true });
    w.addEventListener('error', (err) => reject(new Error(err.message)), { once: true });
    w.postMessage({ type: 'predict', payload: { points, labels } });
  });
}

/**
 * Predict a mask from a bounding box (Legacy wrapper for Refinement)
 */
export async function predictBox(x1, y1, x2, y2) {
  // Box is represented as two points with labels 2 and 3
  const points = [[x1, y1], [x2, y2]];
  const labels = [2, 3];
  return predict(points, labels);
}


/**
 * Standard Process (MODNet, InSPyReNet)
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  return new Promise(async (resolve, reject) => {
    const w = getWorker();

    // Downsize large images to save RAM in worker (Max 2048px)
    const processedCanvas = resizeCanvas(sourceCanvas, 2048);
    lastProcessedCanvas = processedCanvas;
    const originalWidth = sourceCanvas.width;
    const originalHeight = sourceCanvas.height;

    // Zero-copy transfer
    const bitmap = await createImageBitmap(processedCanvas);

    const messageHandler = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        const now = Date.now();
        if (now - lastProgressTime > PROGRESS_THROTTLE || progress === 1) {
            onProgress?.(progress, message);
            lastProgressTime = now;
        }
      } else if (type === 'complete') {
        w.removeEventListener('message', messageHandler);
        resolve(applyMaskToCanvas(lastProcessedCanvas, result));
      } else if (type === 'error') {
        w.removeEventListener('message', messageHandler);
        reject(new Error(error));
      }
    };

    w.addEventListener('message', messageHandler);
    w.addEventListener('error', (err) => reject(new Error(err.message)), { once: true });

    w.postMessage({
      type: 'process',
      payload: {
        bitmap,
        originalWidth, // Note: Worker uses bitmap dimensions, but we send original for reference if needed
        originalHeight,
        model: options.model,
        threshold: options.threshold,
        maskThreshold: options.maskThreshold,
        feathering: options.feathering,
      }
    }, [bitmap]);
  });
}

/**
 * Update the mask without re-running the heavy model
 */
export async function refine(options = {}) {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    const handler = ({ data }) => {
      const { type, result, error } = data;
      if (type === 'complete') {
        resolve(applyMaskToCanvas(lastProcessedCanvas, result));
      } else if (type === 'error') {
        reject(new Error(error));
      }
    };

    w.addEventListener('message', handler, { once: true });
    w.postMessage({
      type: 'refine',
      payload: {
        threshold: options.threshold,
        maskThreshold: options.maskThreshold,
        feathering: options.feathering,
      }
    });
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
 */
function applyMaskToCanvas(sourceCanvas, maskResult) {
  if (!sourceCanvas) return null;
  const { pixelData, width: maskWidth, height: maskHeight } = maskResult;

  // Create high-res result container (matching processed resolution)
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext('2d');

  // Create low-res mask canvas
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskWidth;
  maskCanvas.height = maskHeight;
  const mCtx = maskCanvas.getContext('2d');

  // Convert 1-channel result to RGBA grayscale for masking
  const maskData = new Uint8ClampedArray(maskWidth * maskHeight * 4);
  const rawMask = new Uint8Array(pixelData);
  for (let i = 0; i < rawMask.length; i++) {
      const val = rawMask[i];
      const offset = i * 4;
      // We only strictly need the alpha channel for destination-in,
      // but setting RGB to match ensures visibility if debugging.
      maskData[offset] = val;
      maskData[offset + 1] = val;
      maskData[offset + 2] = val;
      maskData[offset + 3] = val;
  }
  mCtx.putImageData(new ImageData(maskData, maskWidth, maskHeight), 0, 0);

  // Composite: Copy original and mask it via GPU-accelerated drawImage
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
  ctx.globalCompositeOperation = 'source-over';

  return resultCanvas;
}

export default { process, encode, predict, predictBox, refine, clear };
