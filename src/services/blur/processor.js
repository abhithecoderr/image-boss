/**
 * Face Blur Processor (Main Thread Interface)
 * Uses YOLO26 via Web Worker for non-blocking face detection
 *
 * Features:
 * - WebGPU acceleration with WASM fallback
 * - Multiple model variants (nano, small, medium, large, xlarge)
 * - NMS-free detection (no post-processing overhead)
 * - Progress callbacks for UI feedback
 */

import BlurWorker from './worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';

const SERVICE_ID = 'blur';

let isReady = false;
let pendingInit = null;
let currentVariant = 'nano';

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, BlurWorker);
}

/**
 * Model variants - trade-off between speed and accuracy
 */
export const MODEL_VARIANTS = {
  nano: { name: 'Nano', size: '~5MB', description: 'Fastest, good for real-time' },
  small: { name: 'Small', size: '~10MB', description: 'Balanced speed/accuracy' },
  medium: { name: 'Medium', size: '~25MB', description: 'Good accuracy' },
  large: { name: 'Large', size: '~50MB', description: 'High accuracy' },
  xlarge: { name: 'XLarge', size: '~100MB', description: 'Best accuracy' },
};

/**
 * Initialize the face blur worker
 * @param {string} variant - Model variant to load
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{device: string, variant: string}>}
 */
export async function init(variant = 'nano', onProgress) {
  const worker = getWorker();
  if (isReady && currentVariant === variant) {
    return { device: 'cached', variant: currentVariant };
  }

  // If already initializing, wait for it
  if (pendingInit) {
    return pendingInit;
  }

  pendingInit = new Promise((resolve, reject) => {

    // Handle messages
    const handleMessage = (event) => {
      const { type, progress, message, device, variant: v, error } = event.data;

      switch (type) {
        case 'progress':
          onProgress?.(progress, message);
          break;
        case 'ready':
          isReady = true;
          currentVariant = v;
          worker.removeEventListener('message', handleMessage);
          pendingInit = null;
          resolve({ device, variant: v });
          break;
        case 'error':
          worker.removeEventListener('message', handleMessage);
          pendingInit = null;
          reject(new Error(error));
          break;
      }
    };

    worker.addEventListener('message', handleMessage);

    // Send init command
    worker.postMessage({ type: 'init', payload: { variant } });
  });

  return pendingInit;
}

/**
 * Detect faces in an image (returns bounding boxes only)
 */
export async function detectFaces(source, options = {}, onProgress) {
  const worker = getWorker();
  const { variant = currentVariant } = options;

  if (!isReady || variant !== currentVariant) {
    await init(variant, onProgress);
  }

  const bitmap = await createImageBitmap(source);
  const { width, height } = bitmap;

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      const { type, detections, error } = event.data;
      if (type === 'detections') {
        worker.removeEventListener('message', handleMessage);
        resolve(detections);
      } else if (type === 'error') {
        worker.removeEventListener('message', handleMessage);
        reject(new Error(error));
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({
      type: 'detect',
      payload: { bitmap, width, height, variant },
    }, [bitmap]);
  });
}

let lastDetections = [];
let lastSourceBitmap = null;
let lastWidth = 0;
let lastHeight = 0;

/**
 * Get results and cache source for fast tweaking
 */
async function prepareExecution(source) {
    const bitmap = await createImageBitmap(source);
    if (lastSourceBitmap) lastSourceBitmap.close();
    lastSourceBitmap = bitmap; // Cache the bitmap directly — no redundant re-decode
    lastWidth = bitmap.width;
    lastHeight = bitmap.height;
    return { bitmap: await createImageBitmap(lastSourceBitmap), width: lastWidth, height: lastHeight };
}

/**
 * Blur faces in an image
 * @param {HTMLCanvasElement|ImageBitmap} source - Source image
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{canvas: HTMLCanvasElement, detections: Array}>}
 */
export async function process(source, options = {}, onProgress) {
  const worker = getWorker();
  const { blurAmount = 20, radiusScale = 1.0, feathering = 0.75, shape = 1.0, variant = currentVariant } = options;

  // Ensure initialized
  if (!isReady || variant !== currentVariant) {
    await init(variant, onProgress);
  }

  // Get results and cache source for fast tweaking
  const { bitmap, width, height } = await prepareExecution(source);

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      const { type, progress, message, resultBitmap, detections, count, error } = event.data;

      switch (type) {
        case 'progress':
          onProgress?.(progress, message);
          break;
        case 'complete':
          worker.removeEventListener('message', handleMessage);
          lastDetections = detections;

          // No manual canvas creation or putImageData needed
          // The result is already a high-performance ImageBitmap
          resolve({
            canvas: resultBitmap,
            detections,
            count,
          });
          break;
        case 'error':
          worker.removeEventListener('message', handleMessage);
          reject(new Error(error));
          break;
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({
      type: 'blur',
      payload: { bitmap, width, height, blurAmount, radiusScale, feathering, shape, variant },
    }, [bitmap]);
  });
}

/**
 * Re-blur with existing detections for fast UI feedback
 */
export async function updateBlurTransform(options = {}) {
  const worker = getWorker();
  if (!isReady || !lastDetections.length || !lastSourceBitmap) return;
  const { blurAmount = 20, radiusScale = 1.0, feathering = 0.75, shape = 1.0 } = options;

  const bitmap = await createImageBitmap(lastSourceBitmap);

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      const { type, resultBitmap, detections, count, error } = event.data;
      if (type === 'complete') {
        worker.removeEventListener('message', handleMessage);
        resolve({ canvas: resultBitmap, detections, count });
      } else if (type === 'error') {
        worker.removeEventListener('message', handleMessage);
        reject(new Error(error));
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({
      type: 'reblur',
      payload: {
        bitmap,
        width: lastWidth,
        height: lastHeight,
        detections: lastDetections,
        blurAmount,
        radiusScale,
        feathering,
        shape
      },
    }, [bitmap]);
  });
}

/**
 * Dispose worker and free resources
 */
export async function dispose() {
  const worker = getWorker();
  if (!worker) return;
  // Just signal model eviction — don't terminate the worker thread itself
  // (the registry manages the worker lifetime)
  if (lastSourceBitmap) { lastSourceBitmap.close(); lastSourceBitmap = null; }
  worker.postMessage({ type: 'dispose' });
  isReady = false;
  pendingInit = null;
}

/**
 * Check if the processor is ready
 */
export function ready() {
  return isReady;
}

/**
 * Get current model variant
 */
export function getVariant() {
  return currentVariant;
}

export default {
  init,
  process,
  detectFaces,
  dispose,
  ready,
  getVariant,
  MODEL_VARIANTS,
};
