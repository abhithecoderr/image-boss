/**
 * Auto Captioning Processor
 * Uses Web Worker for non-blocking processing
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
 * Generate caption for image
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<HTMLCanvasElement>} Result canvas with caption overlay
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    // Convert canvas to data URL
    const imageData = sourceCanvas.toDataURL('image/png');

    w.onmessage = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        onProgress?.(progress, message);
      } else if (type === 'complete') {
        onProgress?.(0.9, 'Rendering result...');

        // Create result canvas with caption overlay
        const resultCanvas = createCaptionOverlay(sourceCanvas, result.caption);

        // Log caption for easy copying
        console.log('Generated Caption:', result.caption);

        onProgress?.(1, 'Caption generated');
        resolve(resultCanvas);
      } else if (type === 'error') {
        reject(new Error(error));
      }
    };

    w.onerror = (err) => reject(new Error(err.message));

    // Send image to worker
    w.postMessage({ type: 'process', payload: { imageData } });
  });
}

/**
 * Create canvas with caption overlay
 */
function createCaptionOverlay(sourceCanvas, caption) {
  const padding = 60;
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height + padding;
  const ctx = resultCanvas.getContext('2d');

  // Fill background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);

  // Draw original image
  ctx.drawImage(sourceCanvas, 0, 0);

  // Draw caption bar
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, sourceCanvas.height, resultCanvas.width, padding);

  // Draw caption text
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Word wrap if needed
  const maxWidth = resultCanvas.width - 40;
  const words = caption.split(' ');
  let line = '';
  let y = sourceCanvas.height + padding / 2;

  for (let word of words) {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), resultCanvas.width / 2, y);
      line = word + ' ';
      y += 20;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), resultCanvas.width / 2, y);

  // Store caption for copy functionality
  resultCanvas.dataset.caption = caption;

  return resultCanvas;
}

export default { process };
