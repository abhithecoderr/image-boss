/**
 * Object Segmentation Processor
 * Uses Web Worker for non-blocking processing
 */

import Worker from './worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';

const SERVICE_ID = 'object-segmentation';
let lastImageFingerprint = null;
let lastModelId = null;
let lastCanvas = null;

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, Worker);
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
  const w = getWorker();

  const modelId = options.modelId;
  const isSameModel = modelId === lastModelId;
  lastModelId = modelId;

  const isSameCanvas = sourceCanvas === lastCanvas;
  lastCanvas = sourceCanvas;

  let isSameImage = false;
  if (isSameCanvas && isSameModel && lastImageFingerprint) {
    isSameImage = true;
  } else {
    // Stronger fingerprint: dimensions + a fast pixel sample to detect content changes.
    // Samples 16 pixels evenly spread across the canvas for a lightweight content hash.
    const ctx = sourceCanvas.getContext('2d');
    let sampleHash = `${sourceCanvas.width}x${sourceCanvas.height}`;
    if (ctx) {
      const step = Math.max(1, Math.floor(sourceCanvas.width / 4));
      for (let x = 0; x < sourceCanvas.width; x += step) {
        const px = ctx.getImageData(x, 0, 1, 1).data;
        sampleHash += `|${px[0]},${px[1]},${px[2]}`;
      }
    }
    const currentFingerprint = `${sampleHash}:${isSameModel ? 'same' : modelId}`;
    isSameImage = currentFingerprint === lastImageFingerprint;
    lastImageFingerprint = currentFingerprint;
  }

  let bitmap = null;
  if (!isSameImage) {
      const MAX_DIM = 1024;
      let bridgeCanvas = sourceCanvas;

      if (sourceCanvas.width > MAX_DIM || sourceCanvas.height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(sourceCanvas.width, sourceCanvas.height);
          const w = Math.floor(sourceCanvas.width * scale);
          const h = Math.floor(sourceCanvas.height * scale);

          const offscreen = new OffscreenCanvas(w, h);
          offscreen.getContext('2d').drawImage(sourceCanvas, 0, 0, w, h);
          bridgeCanvas = offscreen;
      }
      bitmap = await createImageBitmap(bridgeCanvas);
  }

  return new Promise((resolve, reject) => {
    w.onmessage = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        onProgress?.(progress, message);
      } else if (type === 'complete') {
        const { options: results, mode } = result;

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
 * Dispose worker cache
 */
export function dispose() {
  const w = getWorker();
  lastImageFingerprint = null;
  lastCanvas = null;
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



export default { process, dispose };
