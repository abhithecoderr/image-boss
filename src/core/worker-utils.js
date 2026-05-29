import { RawImage } from "@huggingface/transformers";

/**
 * Detect WebGPU and fp16 support
 */
export async function getGPUConfig() {
  if (!navigator.gpu) return { supported: false, fp16: false };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { supported: false, fp16: false };
    const hasFP16 = adapter.features.has("shader-f16");
    return { supported: true, fp16: hasFP16 };
  } catch (err) {
    return { supported: false, fp16: false };
  }
}

/**
 * Extract mask from pipeline output and convert to transferrable ImageBitmap.
 * Handles RawImage, [{mask: RawImage}], and raw Tensor outputs.
 */
let workerImageCanvas = null;
let workerImageCtx = null;

export async function rawImageToBitmap(rawImg) {
  const w = Math.round(rawImg.width);
  const h = Math.round(rawImg.height);
  
  if (!workerImageCanvas || workerImageCanvas.width !== w || workerImageCanvas.height !== h) {
    workerImageCanvas = new OffscreenCanvas(w, h);
    workerImageCtx = workerImageCanvas.getContext('2d');
  }

  let data = rawImg.data;
  if (!(data instanceof Uint8ClampedArray)) {
    data = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  }

  const imgData = new ImageData(data, w, h);
  workerImageCtx.putImageData(imgData, 0, 0);
  return await createImageBitmap(workerImageCanvas);
}

/**
 * Converts an ImageBitmap (received from UI) into a RawImage (for transformers inference).
 */
export async function bitmapToRawImage(bitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return await RawImage.fromCanvas(canvas);
}

/**
 * Creates a standardized progress reporter for AI tasks.
 * Maps a localized task (0-100%) to a global progress range (start-end).
 * 
 * @param {Function} onProgress The callback that sends the actual message (prog, msg)
 * @returns {Function} A factory function (start, end, prefix) => callback
 */
export function createProgressReporter(onProgress) {
  return (start, end, messagePrefix = "Downloading...") => {
    return (p) => {
      let pct = 0;
      if (p && typeof p === 'object' && p.status === 'progress') {
        pct = p.total ? ((p.loaded ?? 0) / p.total) * 100 : (p.progress ?? 0);
      } else if (typeof p === 'number') {
        pct = p;
      }

      const progress = start + (pct / 100) * (end - start);
      const message = pct > 0 ? `${messagePrefix} ${Math.round(pct)}%` : messagePrefix;
      onProgress?.(progress, message);
    };
  };
}

/**
 * Standardized generic runner for Web Worker tasks.
 * Abstracts Promises, listeners, cleanups, progress reporting, and errors.
 */
export function runWorkerJob(worker, actionType, payload, transferables = [], onProgress = null) {
  const PROGRESS_THROTTLE = 100;
  let lastProgressTime = 0;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', messageHandler);
      worker.removeEventListener('error', errorHandler);
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
        resolve(result);
      } else if (type === 'error') {
        cleanup();
        reject(new Error(error));
      }
    };

    const errorHandler = (err) => {
      cleanup();
      reject(new Error(err.message || 'Worker task execution failure.'));
    };

    worker.addEventListener('message', messageHandler);
    worker.addEventListener('error', errorHandler, { once: true });

    worker.postMessage({ type: actionType, payload }, transferables);
  });
}

