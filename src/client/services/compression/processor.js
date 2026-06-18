/**
 * Compression Processor
 * Uses browser-image-compression library
 */

import imageCompression from 'browser-image-compression';
import { loadImage, imageToCanvas, canvasToBlob, hasAlphaTransparency } from '../../utils/canvas-utils.js';
import { createProgressReporter } from '../../utils/worker-utils.js';

/**
 * Compress image
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {HTMLCanvasElement} Result canvas
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  let { quality = 80 } = options;
  const compressionQuality = quality / 100;
  const maxSizeMB = options.maxSizeMB || (quality > 90 ? 2 : quality > 50 ? 1 : 0.5);

  onProgress?.(0.1, 'Preparing image...');

  // Detect transparency: if the image has an alpha channel, use lossless-friendly
  // WebP instead of JPEG to avoid destroying the transparent background.
  const mimeType = hasAlphaTransparency(sourceCanvas) ? 'image/webp' : 'image/jpeg';

  // Convert canvas to blob/file for the compression library
  const blob = await canvasToBlob(sourceCanvas, mimeType, 1);
  const fileName = mimeType === 'image/webp' ? 'image.webp' : 'image.jpg';
  const file = new File([blob], fileName, { type: mimeType });

  const originalSize = file.size;
  const report = createProgressReporter(onProgress);

  report(0.2, 0.2, 'Compressing...')();

  const compressionOptions = {
    maxSizeMB,
    maxWidthOrHeight: Math.max(sourceCanvas.width, sourceCanvas.height),
    useWebWorker: true,
    initialQuality: compressionQuality,
    onProgress: report(0.2, 0.8, 'Compressing...'),
  };

  const compressedFile = await imageCompression(file, compressionOptions);
  const compressedSize = compressedFile.size;

  report(0.9, 0.9, 'Rendering result...')();

  // Convert back to canvas for PREVIEW only
  const img = await loadImage(compressedFile);
  const { canvas: resultCanvas } = imageToCanvas(img);

  const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
  report(1, 1, `Reduced by ${reduction}% (${(compressedSize / 1024).toFixed(1)} KB)`)();

  // Return both the canvas (for preview) AND the raw compressed blob (for download)
  // This is critical: re-encoding the canvas would undo all compression work
  resultCanvas._compressedBlob = compressedFile;
  resultCanvas._compressedMimeType = mimeType;

  return resultCanvas;
}

export default { process };
