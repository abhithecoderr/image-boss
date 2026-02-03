/**
 * Line Art Processor
 * Uses Sobel edge detection (WebGL shader)
 */

import { applySobelFilter } from '../../core/canvas-utils.js';

/**
 * Process image to extract line art
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {HTMLCanvasElement} Result canvas
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const { threshold = 50 } = options;

  onProgress?.(0.2, 'Extracting edges...');

  // Create a copy of the canvas
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;
  const ctx = resultCanvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);

  // Apply Sobel filter
  applySobelFilter(resultCanvas, threshold);

  onProgress?.(1, 'Complete');

  return resultCanvas;
}

export default { process };
