/**
 * Helper utilities for the Object Segmentation service.
 * Handles high-performance boolean mask parsing and OffscreenCanvas packing.
 */
import { canvasCache } from "../../utils/canvas-utils.js";



/**
 * Convert 1-channel boolean mask tensor data back into a transferable ImageBitmap.
 * Implements high-performance pixel packing using direct Uint32 ArrayBuffer writes.
 * 
 * @param {Float32Array|Uint8Array} data The raw boolean mask float values
 * @param {number} width Width of the mask tensor
 * @param {number} height Height of the mask tensor
 * @returns {Promise<ImageBitmap>} Output mask bitmap ready for UI layers
 */
export async function extractMaskBitmap(data, width, height) {
  const { canvas: workerMaskCanvas, ctx: workerMaskCtx } = canvasCache.get('mask', width, height, { alpha: true });

  const imageData = workerMaskCtx.createImageData(width, height);
  const data32 = new Uint32Array(imageData.data.buffer);

  // High-performance thresholding and pixel packing
  // Most modern browsers are Little Endian (RGBA in memory order)
  for (let i = 0; i < data.length; i++) {
    const val = data[i] > 0 ? 255 : 0;
    // Pack as AABBGGRR (Little Endian maps to [R, G, B, A] in memory)
    data32[i] = (val << 24) | 0x00ffffff;
  }

  workerMaskCtx.putImageData(imageData, 0, 0);
  return await createImageBitmap(workerMaskCanvas);
}
