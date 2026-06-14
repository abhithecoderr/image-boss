import Worker from './worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';
import { runWorkerJob } from '../../core/worker-utils.js';
import { PAID_MODELS_CONFIG } from '../../config/models.js';
import { samPredict, applySamCutout, applySamOverlay } from '../../api/sam.js';
import { loadImage } from '../../api/birefnet.js';

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

    // Paid tier fields
    this.maskImg = maskResult.maskImg;
    this.tier = maskResult.tier;
  }

  /**
   * Fast thumbnail generation from low-res AI mask
   */
  getThumbnail() {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 120;
    thumbCanvas.height = 120;
    const tCtx = thumbCanvas.getContext('2d');

    if (this.tier === 'paid') {
      tCtx.drawImage(this.maskImg, 0, 0, 120, 120);
    } else {
      // Super fast GPU scaling from transferred mask bitmap
      tCtx.drawImage(this.maskBitmap, 0, 0, 120, 120);
    }
    return thumbCanvas;
  }

  /**
   * Full-resolution rendering (Extraction)
   */
  async render(sourceCanvas, mode) {
    if (this.tier === 'paid') {
      if (mode === 'overlay') {
        return applySamOverlay(sourceCanvas, this.maskImg);
      } else {
        return applySamCutout(sourceCanvas, this.maskImg);
      }
    }
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
  const modelId = options.modelId;
  const tier = options.tier || 'free';

  if (tier === 'paid') {
    onProgress?.(0.1, "Converting image to payload...");
    const imageBlob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, 'image/png'));

    const paidModelCfg = PAID_MODELS_CONFIG[modelId];
    const apiModelTag = paidModelCfg ? paidModelCfg.api_model_tag : "sam-tiny";
    const apiDevice = paidModelCfg ? paidModelCfg.api_runtime : "cpu";

    // Denormalize points from normalized coordinates (0..1) to absolute pixels
    const apiPoints = points.map(p => [
      Math.round(p.x * sourceCanvas.width),
      Math.round(p.y * sourceCanvas.height)
    ]);
    const apiLabels = points.map(p => p.label);

    onProgress?.(0.3, `Uploading to Cloud API (${apiModelTag})...`);
    try {
      const maskBlob = await samPredict('/api', imageBlob, apiPoints, apiLabels, {
        model: apiModelTag,
        device: apiDevice
      });

      onProgress?.(0.8, "Loading response mask...");
      const maskImg = await loadImage(maskBlob);

      // Convert maskImg to ImageBitmap so CandidateCard thumbnail renders correctly
      const maskBitmap = await createImageBitmap(maskImg);

      const candidate = new MaskCandidate({
        maskImg,
        maskBitmap,
        maskWidth: maskImg.naturalWidth || maskImg.width,
        maskHeight: maskImg.naturalHeight || maskImg.height,
        scaleIndex: 0,
        tier: 'paid'
      });

      onProgress?.(1.0, "Segmentation completed.");
      return { options: [candidate], mode: options.mode };
    } catch (err) {
      console.error(`[SAM Paid] Processing failed:`, err);
      throw err;
    }
  }


  const w = getWorker();

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
