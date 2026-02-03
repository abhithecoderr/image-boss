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

let worker = null;
let isReady = false;
let pendingInit = null;
let currentVariant = 'nano';

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
  if (worker && isReady && currentVariant === variant) {
    return { device: 'cached', variant: currentVariant };
  }

  // If already initializing, wait for it
  if (pendingInit) {
    return pendingInit;
  }

  pendingInit = new Promise((resolve, reject) => {
    // Create worker if needed
    if (!worker) {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    }

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
 * @param {HTMLCanvasElement|ImageBitmap} source - Source image
 * @param {Object} options - Detection options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<{x, y, width, height, confidence}>>}
 */
export async function detectFaces(source, options = {}, onProgress) {
  const { variant = currentVariant } = options;

  // Ensure initialized
  if (!isReady || variant !== currentVariant) {
    await init(variant, onProgress);
  }

  // Get image data from source
  const { imageData, width, height } = await getImageData(source);

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      const { type, progress, message, detections, error } = event.data;

      switch (type) {
        case 'progress':
          onProgress?.(progress, message);
          break;
        case 'detections':
          worker.removeEventListener('message', handleMessage);
          resolve(detections);
          break;
        case 'error':
          worker.removeEventListener('message', handleMessage);
          reject(new Error(error));
          break;
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({
      type: 'detect',
      payload: { imageData, width, height, variant },
    });
  });
}

let lastDetections = [];
let lastImageData = null;
let lastWidth = 0;
let lastHeight = 0;

/**
 * Blur faces in an image
 * @param {HTMLCanvasElement|ImageBitmap} source - Source image
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<{canvas: HTMLCanvasElement, detections: Array}>}
 */
export async function process(source, options = {}, onProgress) {
  const { blurAmount = 20, radiusScale = 1.0, feathering = 0.75, shape = 1.0, variant = currentVariant } = options;

  // Ensure initialized
  if (!isReady || variant !== currentVariant) {
    await init(variant, onProgress);
  }

  // Get image data from source
  const { imageData, width, height } = await getImageData(source);
  lastImageData = imageData;
  lastWidth = width;
  lastHeight = height;

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      const { type, progress, message, imageData: resultData, detections, count, error, width: rw, height: rh } = event.data;

      switch (type) {
        case 'progress':
          onProgress?.(progress, message);
          break;
        case 'complete':
          worker.removeEventListener('message', handleMessage);
          lastDetections = detections;

          // Convert result to canvas
          const resultCanvas = document.createElement('canvas');
          resultCanvas.width = rw;
          resultCanvas.height = rh;
          const ctx = resultCanvas.getContext('2d');
          const imgData = new ImageData(new Uint8ClampedArray(resultData), rw, rh);
          ctx.putImageData(imgData, 0, 0);

          resolve({
            canvas: resultCanvas,
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
      payload: { imageData, width, height, blurAmount, radiusScale, feathering, shape, variant },
    });
  });
}

/**
 * Re-blur with existing detections for fast UI feedback
 */
export async function updateBlurTransform(options = {}) {
  if (!worker || !lastDetections.length || !lastImageData) return;
  const { blurAmount = 20, radiusScale = 1.0, feathering = 0.75, shape = 1.0 } = options;

  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      const { type, imageData: resultData, detections, count, error, width: rw, height: rh } = event.data;
      if (type === 'complete') {
        worker.removeEventListener('message', handleMessage);
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = rw;
        resultCanvas.height = rh;
        const ctx = resultCanvas.getContext('2d');
        const imgData = new ImageData(new Uint8ClampedArray(resultData), rw, rh);
        ctx.putImageData(imgData, 0, 0);
        resolve({ canvas: resultCanvas, detections, count });
      } else if (type === 'error') {
        worker.removeEventListener('message', handleMessage);
        reject(new Error(error));
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({
      type: 'reblur',
      payload: {
        imageData: lastImageData,
        width: lastWidth,
        height: lastHeight,
        detections: lastDetections,
        blurAmount,
        radiusScale,
        feathering,
        shape
      },
    });
  });
}

/**
 * Get ImageData from various source types
 */
async function getImageData(source) {
  let canvas, ctx, width, height;

  if (source instanceof HTMLCanvasElement) {
    canvas = source;
    width = canvas.width;
    height = canvas.height;
    ctx = canvas.getContext('2d');
  } else if (source instanceof ImageBitmap) {
    width = source.width;
    height = source.height;
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
  } else if (source instanceof HTMLImageElement) {
    width = source.naturalWidth || source.width;
    height = source.naturalHeight || source.height;
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);
  } else {
    throw new Error('Unsupported source type');
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  return {
    imageData: imageData.data,
    width,
    height,
  };
}

/**
 * Dispose worker and free resources
 */
export async function dispose() {
  if (!worker) return;

  return new Promise((resolve) => {
    const handleMessage = (event) => {
      if (event.data.type === 'disposed') {
        worker.removeEventListener('message', handleMessage);
        worker.terminate();
        worker = null;
        isReady = false;
        pendingInit = null;
        resolve();
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ type: 'dispose' });
  });
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
