/**
 * File Conversion Processor
 * Uses native OffscreenCanvas for format conversion
 */

import { canvasToBlob } from '../../utils/canvas-utils.js';
import { createProgressReporter } from '../../utils/worker-utils.js';

/**
 * Convert image to different format
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {HTMLCanvasElement} Result canvas (same as source but blob is converted)
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const { format = 'image/webp', quality = 0.92 } = options;
  const report = createProgressReporter(onProgress);

  report(0.3, 0.3, `Converting to ${format.split('/')[1].toUpperCase()}...`)();

  // Create result canvas
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext('2d');

  // For formats that don't support transparency (or have poor browser support for it), fill white background
  const noAlphaFormats = ['image/jpeg', 'image/bmp'];
  if (noAlphaFormats.includes(format)) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
  }

  ctx.drawImage(sourceCanvas, 0, 0);

  report(0.8, 0.8, 'Encoding...')();

  // Convert to blob to verify encoding works
  const blob = await canvasToBlob(resultCanvas, format, quality);

  // Attach result for direct download without re-encoding
  resultCanvas._resultBlob = blob;
  resultCanvas._resultMimeType = format;

  // Store format info on canvas for metadata
  resultCanvas.dataset.format = format;
  resultCanvas.dataset.quality = quality;

  report(1, 1, `Converted (${(blob.size / 1024).toFixed(1)} KB)`)();

  return resultCanvas;
}

export default { process };
