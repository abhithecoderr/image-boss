import Worker from './worker.js?worker';
import { resizeCanvas } from '../../core/canvas-utils.js';
import { workerRegistry } from '../../core/worker-registry.js';

const SERVICE_ID = 'background-removal';
const PROGRESS_THROTTLE = 100;

// Cache for real-time post-processing adjustments without rerunning the model
let cachedSourceCanvas = null;
let cachedMaskBitmap = null;
let cachedModelId = null;


function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, Worker);
}

/**
 * Standard Process (MODNet, InSPyReNet, BiRefNet)
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const modelId = options.model || 'inspyrenet';

  // Check cache for post-processing adjustments
  if (cachedSourceCanvas === sourceCanvas && cachedMaskBitmap && cachedModelId === modelId) {
    return applyMaskToCanvas(sourceCanvas, { resultBitmap: cachedMaskBitmap }, options);
  }

  const w = getWorker();
  // Per-call throttle state — prevents concurrent calls from interfering
  let lastProgressTime = 0;

  // Downsize to model-native resolution early to save RAM and transfer time.
  // These sizes should ideally match the target resolution of the models.
  const modelSizes = {
    'modnet': 512,
    'inspyrenet': 768,
    'birefnet': 512,
    'inspyrenet_lite': 384
  };

  const targetSize = modelSizes[modelId] || 768;
  const processedCanvas = resizeCanvas(sourceCanvas, targetSize);
  const originalWidth = sourceCanvas.width;
  const originalHeight = sourceCanvas.height;

  // Zero-copy transfer
  const bitmap = await createImageBitmap(processedCanvas);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener('message', messageHandler);
      w.removeEventListener('error', errorHandler);
      bitmap.close();
    };

    const messageHandler = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        const now = Date.now();
        if (now - lastProgressTime > PROGRESS_THROTTLE || progress === 1) {
            onProgress?.(progress, message);
            lastProgressTime = now;
        }
      } else if (type === 'complete') {
        cleanup();

        // Clean up old cache if it exists and is different from the new one
        if (cachedMaskBitmap && cachedMaskBitmap !== result.resultBitmap) {
            cachedMaskBitmap.close();
        }

        // Update cache
        cachedSourceCanvas = sourceCanvas;
        cachedModelId = modelId;
        cachedMaskBitmap = result.resultBitmap;

        resolve(applyMaskToCanvas(sourceCanvas, result, options));
      } else if (type === 'error') {
        cleanup();
        reject(new Error(error));
      }
    };

    const errorHandler = (err) => {
      cleanup();
      reject(new Error(err.message || 'Worker error'));
    };

    w.addEventListener('message', messageHandler);
    w.addEventListener('error', errorHandler);

    w.postMessage({
      type: 'process',
      payload: {
        bitmap,
        originalWidth,
        originalHeight,
        model: modelId,
      }
    }, [bitmap]);
  });
}

/**
 * Clear worker memory
 */
export async function dispose(clearModels = false) {
    if (cachedMaskBitmap) {
        cachedMaskBitmap.close();
        cachedMaskBitmap = null;
    }
    cachedSourceCanvas = null;
    cachedModelId = null;

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
 * Apply mask result to a source canvas with pixel-level post-processing.
 * Uses direct ImageData manipulation for universal browser support.
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

  // 1. Render the AI mask bitmap to a temp canvas to get its alpha channel
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = W;
  maskCanvas.height = H;
  const maskCtx = maskCanvas.getContext('2d');
  maskCtx.drawImage(resultBitmap, 0, 0, W, H);

  // 2. Apply post-processing to the mask's alpha channel if any sliders are active
  if (needsPostProcess) {
    const maskData = maskCtx.getImageData(0, 0, W, H);
    const alpha = extractAlphaChannel(maskData, W, H);

    let processed = alpha;

    // Edge Shift: Erode (shrink, negative) or Dilate (expand, positive)
    if (edgeShift !== 0) {
      const radius = Math.abs(edgeShift);
      processed = edgeShift < 0
        ? morphAlpha(processed, W, H, radius, 'erode')
        : morphAlpha(processed, W, H, radius, 'dilate');
    }

    // Edge Smoothness: Gaussian-like box blur on the alpha
    if (edgeSmoothness > 0) {
      processed = blurAlpha(processed, W, H, edgeSmoothness);
    }

    // Edge Contrast: Steepen the alpha curve to harden soft edges
    if (edgeContrast > 0) {
      const factor = 1 + (edgeContrast / 4);
      processed = contrastAlpha(processed, W, H, factor);
    }

    // Write processed alpha back into the mask ImageData
    writeAlphaChannel(maskData, processed, W, H);
    maskCtx.putImageData(maskData, 0, 0);
  }

  // 3. Composite: source image masked by the (possibly modified) mask
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = W;
  resultCanvas.height = H;
  const ctx = resultCanvas.getContext('2d');

  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  return resultCanvas;
}

// --- Alpha channel helpers ---

function extractAlphaChannel(imageData, W, H) {
  const out = new Uint8ClampedArray(W * H);
  const d = imageData.data;
  for (let i = 0; i < W * H; i++) {
    out[i] = d[i * 4 + 3];
  }
  return out;
}

function writeAlphaChannel(imageData, alpha, W, H) {
  const d = imageData.data;
  for (let i = 0; i < W * H; i++) {
    d[i * 4 + 3] = alpha[i];
  }
}

/**
 * Morphological erode/dilate on alpha channel using a circular kernel.
 */
function morphAlpha(alpha, W, H, radius, mode) {
  const out = new Uint8ClampedArray(W * H);
  const r = Math.ceil(radius);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let val = mode === 'erode' ? 255 : 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          if (dx * dx + dy * dy > r * r) continue; // circular kernel
          const v = alpha[ny * W + nx];
          val = mode === 'erode' ? Math.min(val, v) : Math.max(val, v);
        }
      }
      out[y * W + x] = val;
    }
  }
  return out;
}

/**
 * Separable box blur on alpha channel (two passes for Gaussian-like result).
 */
function blurAlpha(alpha, W, H, radius) {
  const r = Math.ceil(radius);
  const size = 2 * r + 1;

  // Horizontal pass
  const temp = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < W) { sum += alpha[y * W + nx]; count++; }
      }
      temp[y * W + x] = (sum / count) | 0;
    }
  }

  // Vertical pass
  const out = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < H) { sum += temp[ny * W + x]; count++; }
      }
      out[y * W + x] = (sum / count) | 0;
    }
  }
  return out;
}

/**
 * Contrast on alpha channel — pushes values toward 0 or 255.
 */
function contrastAlpha(alpha, W, H, factor) {
  const out = new Uint8ClampedArray(W * H);
  for (let i = 0; i < W * H; i++) {
    const normalized = alpha[i] / 255;
    const contrasted = Math.max(0, Math.min(1, (normalized - 0.5) * factor + 0.5));
    out[i] = (contrasted * 255) | 0;
  }
  return out;
}

export default { process, dispose };
