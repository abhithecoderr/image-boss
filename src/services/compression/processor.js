/**
 * Compression Processor
 * Uses browser-image-compression library
 */

import imageCompression from 'browser-image-compression';
import { loadImage, imageToCanvas, canvasToBlob } from '../../core/canvas-utils.js';

/**
 * Compress image
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {HTMLCanvasElement} Result canvas
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const { maxSizeMB = 1, quality = 0.8 } = options;

  onProgress?.(0.1, 'Preparing image...');

  // Convert canvas to blob/file for the compression library
  const blob = await canvasToBlob(sourceCanvas, 'image/jpeg', 1);
  const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });

  const originalSize = file.size;

  onProgress?.(0.2, 'Compressing...');

  const compressionOptions = {
    maxSizeMB,
    maxWidthOrHeight: Math.max(sourceCanvas.width, sourceCanvas.height),
    useWebWorker: true,
    initialQuality: quality,
    onProgress: (percent) => {
      onProgress?.(0.2 + percent * 0.006, `Compressing... ${percent}%`);
    },
  };

  const compressedFile = await imageCompression(file, compressionOptions);
  const compressedSize = compressedFile.size;

  onProgress?.(0.9, 'Rendering result...');

  // Convert back to canvas
  const img = await loadImage(compressedFile);
  const { canvas: resultCanvas } = imageToCanvas(img);

  const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

  onProgress?.(1, `Reduced by ${reduction}% (${(compressedSize / 1024).toFixed(1)} KB)`);

  return resultCanvas;
}

export default { process };
