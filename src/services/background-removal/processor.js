import Worker from './worker.js?worker';
import { resizeCanvas } from '../../core/canvas-utils.js';
import { workerRegistry } from '../../core/worker-registry.js';
import { runWorkerJob } from '../../core/worker-utils.js';

const SERVICE_ID = 'background-removal';

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, Worker);
}

/**
 * Standard Process (MODNet, InSPyReNet, BiRefNet)
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const modelId = options.model || 'inspyrenet';

  // Check cache for post-processing adjustments (canvas-scoped to prevent memory leaks)
  const cache = sourceCanvas._bgRemovalCache || {};
  if (cache.sourceCanvas === sourceCanvas && cache.maskBitmap && cache.modelId === modelId) {
    return applyMaskToCanvas(sourceCanvas, { resultBitmap: cache.maskBitmap }, options);
  }

  const w = getWorker();
  
  // Downsize to model-native resolution early to save RAM and transfer time.
  // These sizes should ideally match the target resolution of the models.
  const modelSizes = {
    'modnet': 512,
    'inspyrenet': 768,
    'birefnet': 512,
    'inspyrenet_lite': 384,
    'ben2': 512
  };

  const targetSize = modelSizes[modelId] || 768;
  const processedCanvas = resizeCanvas(sourceCanvas, targetSize);
  const originalWidth = sourceCanvas.width;
  const originalHeight = sourceCanvas.height;

  // Zero-copy transfer
  const bitmap = await createImageBitmap(processedCanvas);

  try {
    const result = await runWorkerJob(
      w,
      'process',
      {
        bitmap,
        originalWidth,
        originalHeight,
        model: modelId,
      },
      [bitmap],
      onProgress
    );

    // Clean up old cache if it exists and is different from the new one
    const oldCache = sourceCanvas._bgRemovalCache || {};
    if (oldCache.maskBitmap && oldCache.maskBitmap !== result.resultBitmap) {
      oldCache.maskBitmap.close();
    }

    // Update canvas-scoped cache
    sourceCanvas._bgRemovalCache = {
      sourceCanvas,
      modelId,
      maskBitmap: result.resultBitmap
    };

    return applyMaskToCanvas(sourceCanvas, result, options);
  } catch (err) {
    console.error(`[Background Removal] Processing failed:`, err);
    // Terminate worker thread on crash so it recreates on next call
    workerRegistry.terminate(SERVICE_ID);
    throw err;
  } finally {
    bitmap.close();
  }
}

/**
 * Clear worker memory
 */
export async function dispose(clearModels = false) {
  const w = getWorker();
  return runWorkerJob(w, 'clear', { clearModels });
}

import { extractAlphaChannel, writeAlphaChannel, morphAlpha } from './helpers.js';

/**
 * Apply mask result to a source canvas with pixel-level post-processing.
 * Uses native canvas filters for accelerated smoothness and contrast, and morphological CPU fallback for edge shifting.
 */
function applyMaskToCanvas(sourceCanvas, maskResult, options = {}) {
  if (!sourceCanvas) return null;
  const { resultBitmap } = maskResult;
  const W = sourceCanvas.width;
  const H = sourceCanvas.height;

  // Extract post-processing options
  const edgeShift = Number(options.edgeShift) || 0;
  const edgeSmoothness = Number(options.edgeSmoothness) || 0;
  const edgeContrast = Number(options.edgeContrast) || 0;
  const needsPostProcess = edgeShift !== 0 || edgeSmoothness !== 0 || edgeContrast !== 0;

  // 1. Render the AI mask bitmap to a temp scratch canvas at MODEL native resolution
  const maskW = resultBitmap.width;
  const maskH = resultBitmap.height;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskW;
  maskCanvas.height = maskH;
  const maskCtx = maskCanvas.getContext('2d');

  // 2. Apply post-processing to the mask
  if (needsPostProcess) {
    if (edgeShift !== 0) {
      // Erode/Dilate requires CPU morphological operations
      maskCtx.drawImage(resultBitmap, 0, 0, maskW, maskH);
      const maskData = maskCtx.getImageData(0, 0, maskW, maskH);
      const alpha = extractAlphaChannel(maskData, maskW, maskH);
      
      const radius = Math.abs(edgeShift);
      const processed = edgeShift < 0
        ? morphAlpha(alpha, maskW, maskH, radius, 'erode')
        : morphAlpha(alpha, maskW, maskH, radius, 'dilate');

      writeAlphaChannel(maskData, processed, maskW, maskH);
      maskCtx.putImageData(maskData, 0, 0);
    } else {
      maskCtx.drawImage(resultBitmap, 0, 0, maskW, maskH);
    }

    // Apply Blur and Contrast using hardware-accelerated Canvas Filters
    if (edgeSmoothness > 0 || edgeContrast > 0) {
      const filterCanvas = document.createElement('canvas');
      filterCanvas.width = maskW;
      filterCanvas.height = maskH;
      const filterCtx = filterCanvas.getContext('2d');
      
      const blur = edgeSmoothness > 0 ? `blur(${edgeSmoothness}px)` : '';
      const contrast = edgeContrast > 0 ? `contrast(${100 + edgeContrast * 25}%)` : '';
      filterCtx.filter = [blur, contrast].filter(Boolean).join(' ');
      filterCtx.drawImage(maskCanvas, 0, 0);
      
      maskCtx.clearRect(0, 0, maskW, maskH);
      maskCtx.drawImage(filterCanvas, 0, 0);
    }
  } else {
    maskCtx.drawImage(resultBitmap, 0, 0, maskW, maskH);
  }

  // 3. Composite: source image masked by the (possibly modified) mask
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = W;
  resultCanvas.height = H;
  const ctx = resultCanvas.getContext('2d');

  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  // Hardware bilinear scaling handles high-quality upscale to full canvas dimensions instantly!
  ctx.drawImage(maskCanvas, 0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  return resultCanvas;
}

export default { process, dispose };
