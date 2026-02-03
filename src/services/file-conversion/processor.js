/**
 * File Conversion Processor
 * Uses native OffscreenCanvas for format conversion
 */

import { canvasToBlob } from '../../core/canvas-utils.js';

/**
 * Convert image to different format
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {HTMLCanvasElement} Result canvas (same as source but blob is converted)
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const { format = 'image/webp', quality = 0.92 } = options;

  onProgress?.(0.3, `Converting to ${format.split('/')[1].toUpperCase()}...`);

  // Create result canvas
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext('2d');

  // For JPEG, fill white background (no transparency)
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
  }

  ctx.drawImage(sourceCanvas, 0, 0);

  onProgress?.(0.8, 'Encoding...');

  // Convert to blob to verify encoding works
  const blob = await canvasToBlob(resultCanvas, format, quality);

  // Store format info on canvas for download
  resultCanvas.dataset.format = format;
  resultCanvas.dataset.quality = quality;

  onProgress?.(1, `Converted (${(blob.size / 1024).toFixed(1)} KB)`);

  return resultCanvas;
}

export default { process };
