/**
 * Object Segmentation Processor
 * Uses Web Worker for non-blocking processing
 */

import Worker from './worker.js?worker';

let worker = null;
let lastImageFingerprint = null;
let lastModelId = null;

function getWorker() {
  if (!worker) {
    worker = new Worker();
  }
  return worker;
}

/**
 * Represents a segmentation variant that can be rendered on-demand.
 * This "Lazy" approach prevents UI freezes by avoiding full-res rendering for non-selected candidates.
 */
class MaskCandidate {
  constructor(maskResult) {
    this.maskBitmap = maskResult.maskBitmap;
    this.maskWidth = maskResult.maskWidth;
    this.maskHeight = maskResult.maskHeight;
    this.scaleIndex = maskResult.scaleIndex;
  }

  /**
   * Fast thumbnail generation from low-res AI mask
   */
  getThumbnail() {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 120;
    thumbCanvas.height = 120;
    const tCtx = thumbCanvas.getContext('2d');

    // Super fast GPU scaling from transferred mask bitmap
    tCtx.drawImage(this.maskBitmap, 0, 0, 120, 120);
    return thumbCanvas;
  }

  /**
   * Full-resolution rendering (Extraction)
   */
  async render(sourceCanvas, mode) {
    return applyExtraction(sourceCanvas, this);
  }
}

/**
 * Segment object at click point
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options (includes clickX, clickY)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Result object with lazy candidates
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const points = options.points || [];
  console.log('[Processor] Starting object process', { pointCount: points.length, mode: options.mode });

  return new Promise(async (resolve, reject) => {
    const w = getWorker();

    const modelId = options.modelId;
    const isSameModel = modelId === lastModelId;
    lastModelId = modelId;

    const currentFingerprint = `${sourceCanvas.width}x${sourceCanvas.height}`;
    const isSameImage = currentFingerprint === lastImageFingerprint && isSameModel;
    lastImageFingerprint = currentFingerprint;

    let bitmap = null;
    if (!isSameImage) {
        const MAX_DIM = 1024;
        let bridgeCanvas = sourceCanvas;

        if (sourceCanvas.width > MAX_DIM || sourceCanvas.height > MAX_DIM) {
            console.log(`[Processor] Downscaling high-res input for AI...`);
            const scale = MAX_DIM / Math.max(sourceCanvas.width, sourceCanvas.height);
            const w = Math.floor(sourceCanvas.width * scale);
            const h = Math.floor(sourceCanvas.height * scale);

            const offscreen = new OffscreenCanvas(w, h);
            offscreen.getContext('2d').drawImage(sourceCanvas, 0, 0, w, h);
            bridgeCanvas = offscreen;
        }
        bitmap = await createImageBitmap(bridgeCanvas);
    }

    w.onmessage = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        onProgress?.(progress, message);
      } else if (type === 'complete') {
        const { options: results, mode } = result;
        console.log('[Processor] Worker complete', { maskCount: results.length, mode });

        // Optimization: Return Lazy Candidates instead of full-res canvases
        const candidates = results.map(opt => new MaskCandidate(opt));
        resolve({ options: candidates, mode });
      } else if (type === 'error') {
        if (error.includes('No image loaded') || error.includes('cached embeddings')) {
           lastImageFingerprint = null;
        }
        reject(new Error(error));
      }
    };

    w.onerror = (err) => reject(new Error(err.message));

    const transferables = bitmap ? [bitmap] : [];
    w.postMessage({ type: 'process', payload: { bitmap, points, box: options.box || null, mode: options.mode, modelId } }, transferables);
  });
}

/**
 * Clear worker cache
 */
export function clear() {
  const w = getWorker();
  lastImageFingerprint = null;
  w.postMessage({ type: 'clear' });
}

/**
 * Create transparent extraction (GPU Optimized)
 */
function applyExtraction(sourceCanvas, candidate) {
  const { maskBitmap } = candidate;

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext('2d');

  // GPU-accelerated scaling and hardware compositing
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';

  // Apply a subtle blur filters to smooth AI-generated segmentation edges
  ctx.filter = 'blur(1px)';
  ctx.drawImage(maskBitmap, 0, 0, resultCanvas.width, resultCanvas.height);

  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  return resultCanvas;
}



export default { process, clear };
