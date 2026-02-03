/**
 * Upscaling Processor
 * Uses UpscalerJS for efficient, tile-based upscaling without UI freezes
 */

import Worker from './worker.js?worker';

let worker = null;

function getWorker() {
  if (!worker) {
    worker = new Worker();
  }
  return worker;
}

/**
 * Upscale image by 2x using UpscalerJS in a Worker
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<HTMLCanvasElement>} Result canvas (2x resolution)
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  return new Promise(async (resolve, reject) => {
    const w = getWorker();

    // Zero-copy transfer
    const bitmap = await createImageBitmap(sourceCanvas);

    const messageHandler = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        onProgress?.(progress, message);
      } else if (type === 'complete') {
        w.removeEventListener('message', messageHandler);

        // Convert result ImageBitmap back to Canvas
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = result.width;
        resultCanvas.height = result.height;
        const ctx = resultCanvas.getContext('2d');
        ctx.drawImage(result, 0, 0);
        result.close(); // Clean up transferable

        onProgress?.(1, `Upscaled to ${resultCanvas.width}x${resultCanvas.height}`);
        resolve(resultCanvas);
      } else if (type === 'error') {
        w.removeEventListener('message', messageHandler);
        reject(new Error(error));
      }
    };

    w.addEventListener('message', messageHandler);
    w.addEventListener('error', (err) => reject(new Error(err.message)), { once: true });

    w.postMessage({ type: 'upscale', payload: { bitmap, ...options } }, [bitmap]);
  });
}

/**
 * Update upscaling filters without re-running AI tiling
 */
export async function refine(options = {}) {
    return new Promise((resolve, reject) => {
        const w = getWorker();

        const messageHandler = ({ data }) => {
            const { type, result, error } = data;
            if (type === 'complete') {
                w.removeEventListener('message', messageHandler);

                // Convert result ImageBitmap back to Canvas
                const resultCanvas = document.createElement('canvas');
                resultCanvas.width = result.width;
                resultCanvas.height = result.height;
                const ctx = resultCanvas.getContext('2d');
                ctx.drawImage(result, 0, 0);
                result.close();

                resolve(resultCanvas);
            } else if (type === 'error') {
                w.removeEventListener('message', messageHandler);
                reject(new Error(error));
            }
        };

        w.addEventListener('message', messageHandler);
        w.postMessage({ type: 'refine', payload: options });
    });
}

export default { process, refine };
