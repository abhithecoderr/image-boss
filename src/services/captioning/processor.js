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
  console.log('[Processor] Starting Florence-2 captioning...');

  return new Promise(async (resolve, reject) => {
    const w = getWorker();

    // Use zero-copy ImageBitmap transfer
    const bitmap = await createImageBitmap(sourceCanvas);

    w.onmessage = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        onProgress?.(progress, message);
      } else if (type === 'complete') {
        onProgress?.(0.95, 'Rendering result...');

        // Generate the final display canvas (for download)
        const resultCanvas = createCaptionOverlay(sourceCanvas, result.caption);

        // Detailed log of structured vision result
        console.log('[Processor] Florence-2 Result:', result.raw);
        console.log('[Processor] Caption:', result.caption);

        onProgress?.(1, 'Complete!');
        resolve({ canvas: resultCanvas, caption: result.caption });
      } else if (type === 'error') {
        console.error('[Processor] Worker Error:', error);
        reject(new Error(error));
      }
    };

    w.onerror = (err) => reject(new Error(err.message));

    // Send to worker
    w.postMessage({
      type: 'process',
      payload: {
        bitmap,
        modelId: options.modelId || 'onnx-community/Florence-2-base-ft',
        task: options.task || '<MORE_DETAILED_CAPTION>'
      }
    }, [bitmap]);
  });
}

/**
 * Create canvas with caption overlay
 */
function createCaptionOverlay(sourceCanvas, caption) {
  const resultCanvas = document.createElement('canvas');
  const ctx = resultCanvas.getContext('2d');

  // Setup font for measurement
  const fontSize = 24;
  ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
  const maxWidth = sourceCanvas.width - 80;

  // 1. Calculate word wrap and required height
  const words = caption.split(' ');
  const lines = [];
  let currentLine = '';

  for (let word of words) {
    const testLine = currentLine + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && currentLine !== '') {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine.trim());

  const lineHeight = fontSize * 1.4;
  const textHeight = lines.length * lineHeight;
  const verticalPadding = 60;
  const bottomBarHeight = textHeight + verticalPadding;

  // 2. Setup Canvas Dimensions
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height + bottomBarHeight;

  // Re-apply font after resize
  ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;

  // 3. Render
  // Background
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);

  // Original Image
  ctx.drawImage(sourceCanvas, 0, 0);

  // Caption Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  lines.forEach((line, i) => {
    const y = sourceCanvas.height + (verticalPadding / 2) + (i * lineHeight) + (lineHeight / 2);
    ctx.fillText(line, resultCanvas.width / 2, y);
  });

  // Store caption for copy functionality if needed
  resultCanvas.dataset.caption = caption;

  return resultCanvas;
}

export default { process };
