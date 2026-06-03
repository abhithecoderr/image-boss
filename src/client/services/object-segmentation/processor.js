import Worker from './worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';
import { runWorkerJob } from '../../core/worker-utils.js';

const SERVICE_ID = 'object-segmentation';

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

  // Always resize canvas to standard MAX_DIM if it exceeds limits
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

  const bitmap = await createImageBitmap(bridgeCanvas);

  const payload = { bitmap, points, mode: options.mode, modelId };
  const transferables = [bitmap];

  const result = await runWorkerJob(w, 'process', payload, transferables, onProgress);
  const { options: results, mode } = result;
  
  const candidates = results.map(opt => new MaskCandidate(opt));
  return { options: candidates, mode };
}

/**
 * Dispose worker
 */
export function dispose() {
  const w = getWorker();
  w.postMessage({ type: 'dispose' });
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
