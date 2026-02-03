/**
 * Object Segmentation Processor
 * Uses Web Worker for non-blocking processing
 */

import Worker from './worker.js?worker';
import { surgicalInpaint } from '../../core/canvas-utils.js';

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
 * Segment object at click point
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options (includes clickX, clickY)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<HTMLCanvasElement>} Result canvas with segmentation highlight
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const points = options.points || [];
  console.log('[Processor] Starting process', { pointCount: points.length, mode: options.mode });

  return new Promise(async (resolve, reject) => {
    const w = getWorker();

    const modelId = options.modelId;
    const isSameModel = modelId === lastModelId;
    lastModelId = modelId;

    // Performance Optimization: Cache Signaling
    // Fingerprint based on dimensions should be sufficient for session-level caching
    const currentFingerprint = `${sourceCanvas.width}x${sourceCanvas.height}`;
    const isSameImage = currentFingerprint === lastImageFingerprint && isSameModel;
    lastImageFingerprint = currentFingerprint;

    let bitmap = null;
    if (!isSameImage) {
        // Performance Optimization: Input Capping
        // 1024px provides enough detail for professional segmentation while staying WebGPU-safe
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

        // Zero-copy transfer: Create ImageBitmap and send as transferable
        bitmap = await createImageBitmap(bridgeCanvas);
    } else {
        console.log('[Processor] Cache hit: Skipping image transfer');
    }

    w.onmessage = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        onProgress?.(progress, message);
      } else if (type === 'complete') {
        const { options: results, mode } = result;
        console.log('[Processor] Worker complete', { maskCount: results.length, mode });

        // Generate options for each mask
        const resultOptions = results.map((opt, idx) => {
           console.log(`[Processor] Applying ${mode} for mask ${idx}...`);
           if (mode === 'remove') {
              return applyRemoval(sourceCanvas, opt);
           } else {
              return applyExtraction(sourceCanvas, opt);
           }
        });

        resolve({ options: resultOptions });
      } else if (type === 'error') {
        console.error('[Processor] Worker reported error:', error);

        // Cache Recovery: If worker lost its cache (e.g. after crash), force re-upload next time
        if (error.includes('No image loaded') || error.includes('cached embeddings')) {
           console.warn('[Processor] Cache desync detected. Invalidating fingerprint.');
           lastImageFingerprint = null;
        }

        reject(new Error(error));
      }
    };

    w.onerror = (err) => reject(new Error(err.message));

    const transferables = bitmap ? [bitmap] : [];
    w.postMessage({ type: 'process', payload: { bitmap, points, mode: options.mode, modelId } }, transferables);
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
 * Create transparent extraction
 */
function applyExtraction(sourceCanvas, result) {
  const { maskData, maskWidth, maskHeight } = result;

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext('2d');

  // Create low-res mask canvas (Optimized)
  const maskOverlay = document.createElement('canvas');
  maskOverlay.width = maskWidth;
  maskOverlay.height = maskHeight;
  const moCtx = maskOverlay.getContext('2d');
  const moImageData = moCtx.createImageData(maskWidth, maskHeight);
  const moData = moImageData.data;

  for (let i = 0; i < maskData.length; i++) {
    const val = maskData[i];
    const offset = i * 4;
    moData[offset] = val;
    moData[offset + 1] = val;
    moData[offset + 2] = val;
    moData[offset + 3] = val;
  }
  moCtx.putImageData(moImageData, 0, 0);

  // Draw original and use GPU-accelerated scaling for the mask
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  // Scaling the 768px mask to 4K+ happens on the GPU here
  ctx.drawImage(maskOverlay, 0, 0, resultCanvas.width, resultCanvas.height);
  ctx.globalCompositeOperation = 'source-over';

  return resultCanvas;
}

/**
 * Apply AI removal (stub for inpaint)
 */
function applyRemoval(sourceCanvas, result) {
    const { maskData, maskWidth, maskHeight } = result;
    console.log(`[Processor] Applying Removal (Surgical Inpaint)...`);

    // 1. Create original copy
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = sourceCanvas.width;
    resultCanvas.height = sourceCanvas.height;
    const ctx = resultCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);

    // 2. Create the mask canvas for the inpaint utility
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = resultCanvas.width;
    maskCanvas.height = resultCanvas.height;
    const mCtx = maskCanvas.getContext('2d');

    const maskOverlay = document.createElement('canvas');
    maskOverlay.width = maskWidth;
    maskOverlay.height = maskHeight;
    const moCtx = maskOverlay.getContext('2d');
    const moData = moCtx.createImageData(maskWidth, maskHeight);
    const data = moData.data;
    for(let i=0; i<maskData.length; i++) {
        const val = maskData[i];
        const offset = i * 4;
        data[offset] = val; // red
        data[offset+3] = val; // alpha
    }
    moCtx.putImageData(moData, 0, 0);

    // Mask Dilation & GPU Scaling (Optimized)
    // We dilate on the low-res version (faster) then scale.
    mCtx.save();
    mCtx.shadowBlur = 2; // Reduced for low-res domain
    mCtx.shadowColor = 'red';
    // Single draw to low-res mask container (mCtx is the full-res container)
    // Actually, let's dilate on the low-res and then draw to mCtx
    mCtx.drawImage(maskOverlay, 0, 0, maskCanvas.width, maskCanvas.height);
    mCtx.restore();

    // 3. Apply Surgical Inpaint
    surgicalInpaint(resultCanvas, maskCanvas);

    return resultCanvas;
}

export default { process };
