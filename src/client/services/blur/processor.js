
import BlurWorker from './worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';
import { runWorkerJob } from '../../core/worker-utils.js';

const SERVICE_ID = 'blur';

let isReady = false;
let pendingInit = null;
let currentVariant = 'nano';

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, BlurWorker);
}

// Reset our ready-state whenever the registry evicts this worker so that
// the next process() call re-initializes the model properly.
workerRegistry.onDispose(SERVICE_ID, () => {
  isReady = false;
  pendingInit = null;
});

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
 */
export async function init(variant = 'nano', onProgress) {
  const worker = getWorker();
  if (isReady && currentVariant === variant) {
    return { device: 'cached', variant: currentVariant };
  }

  if (pendingInit) {
    return pendingInit;
  }

  pendingInit = runWorkerJob(worker, 'init', { variant }, [], onProgress).then((res) => {
    isReady = true;
    currentVariant = variant;
    pendingInit = null;
    return res;
  }).catch((err) => {
    pendingInit = null;
    throw err;
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

  try {
    return await runWorkerJob(
      worker,
      'detect',
      { bitmap, width, height, variant },
      [bitmap],
      onProgress
    );
  } finally {
    bitmap.close();
  }
}

/**
 * Get results and cache source for fast tweaking (canvas-scoped to prevent memory leaks)
 */
async function prepareExecution(source) {
  const bitmap = await createImageBitmap(source);

  const oldCache = source._blurCache || {};
  if (oldCache.lastSourceBitmap) {
    try { oldCache.lastSourceBitmap.close(); } catch (_) {}
  }

  source._blurCache = {
    lastSourceBitmap: await createImageBitmap(bitmap),
    lastWidth: bitmap.width,
    lastHeight: bitmap.height,
    lastDetections: []
  };

  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height
  };
}

/**
 * Blur faces in an image
 */
export async function process(source, options = {}, onProgress) {
  const worker = getWorker();
  const { blurAmount = 20, radiusScale = 1.0, feathering = 0.75, shape = 1.0, variant = currentVariant } = options;

  if (!isReady || variant !== currentVariant) {
    await init(variant, onProgress);
  }

  const { bitmap, width, height } = await prepareExecution(source);

  try {
    const result = await runWorkerJob(
      worker,
      'blur',
      { bitmap, width, height, blurAmount, radiusScale, feathering, shape, variant },
      [bitmap],
      onProgress
    );

    if (source._blurCache) {
      source._blurCache.lastDetections = result.detections;
    }

    return {
      canvas: result.resultBitmap,
      detections: result.detections,
      count: result.count
    };
  } catch (err) {
    console.error(`[Face Blur] Processing failed:`, err);
    throw err;
  }
}

/**
 * Re-blur with existing detections for fast UI feedback
 */
export async function updateBlurTransform(source, options = {}) {
  const worker = getWorker();
  const cache = source?._blurCache;
  if (!isReady || !cache || !cache.lastDetections?.length || !cache.lastSourceBitmap) return;

  const { blurAmount = 20, radiusScale = 1.0, feathering = 0.75, shape = 1.0 } = options;
  const bitmap = await createImageBitmap(cache.lastSourceBitmap);

  try {
    const result = await runWorkerJob(
      worker,
      'reblur',
      {
        bitmap,
        width: cache.lastWidth,
        height: cache.lastHeight,
        detections: cache.lastDetections,
        blurAmount,
        radiusScale,
        feathering,
        shape
      },
      [bitmap]
    );

    return {
      canvas: result.resultBitmap,
      detections: result.detections,
      count: result.count
    };
  } catch (err) {
    console.error(`[Face Blur] Re-blur failed:`, err);
    throw err;
  }
}

/**
 * Dispose worker and free resources
 */
export async function dispose() {
  workerRegistry.dispose(SERVICE_ID);
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
