/**
 * Style Transfer Processor
 * Currently disabled - Xenova/magenta model is unavailable in transformers.js
 * TODO: Implement with TensorFlow.js when available
 */

/**
 * Process style transfer (COMING SOON)
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<HTMLCanvasElement>} Result canvas
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  onProgress?.(0.5, 'Feature coming soon...');

  // For now, return the original image with a message
  throw new Error('Style Transfer is coming soon! The AI model is currently being updated for browser compatibility.');
}

export default { process };
