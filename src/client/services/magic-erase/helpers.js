/**
 * Helper utilities for the Magic Erase service.
 * Handles dimensional normalization, tensor packing, and canvas composition 
 * for LaMa inpainting on both the main thread and background worker.
 */

/**
 * Checks if a pixel in the mask array is part of the active mask region.
 * Returns true if the pixel is bright/colored and not fully transparent.
 * 
 * @param {Uint8ClampedArray|Uint8Array} mask Raw mask image data
 * @param {number} pi Pixel data index (i * 4)
 * @returns {boolean}
 */
export function isMaskPixel(mask, pi) {
  const r = mask[pi];
  const g = mask[pi + 1];
  const b = mask[pi + 2];
  const a = mask[pi + 3];
  return (r > 10 || g > 10 || b > 10) && a > 10;
}

// ===========================================================================
// MAIN THREAD HELPERS
// ===========================================================================

/**
 * Calculate the aspect ratio padding and extract ImageData from the original and mask canvases.
 * Scales inputs to a standard 512x512 box which the model requires.
 * 
 * @param {HTMLCanvasElement} originalCanvas High-res source canvas
 * @param {HTMLCanvasElement} maskCanvas Overlay drawn mask canvas
 * @returns {Object} Extracted imageData, maskImageData, and mapping parameters
 */
export function prepareInpaintInputs(originalCanvas, maskCanvas) {
  const imgW = originalCanvas.width;
  const imgH = originalCanvas.height;

  // 1. Scan mask to find the bounding box of active mask pixels
  const maskCtx2 = maskCanvas.getContext('2d');
  const maskData = maskCtx2.getImageData(0, 0, imgW, imgH);
  const data = maskData.data;

  let minX = imgW, minY = imgH, maxX = 0, maxY = 0;
  let hasActiveMask = false;

  for (let y = 0; y < imgH; y++) {
    for (let x = 0; x < imgW; x++) {
      const idx = (y * imgW + x) * 4;
      if (isMaskPixel(data, idx)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasActiveMask = true;
      }
    }
  }

  // Fallback if no mask is drawn (should not happen, but keep safe)
  if (!hasActiveMask) {
    minX = 0; minY = 0; maxX = imgW; maxY = imgH;
  }

  // 2. Expand the crop box to provide surrounding context to the model (e.g., 25% padding)
  const maskW = maxX - minX;
  const maskH = maxY - minY;
  const pad = Math.max(128, Math.round(Math.max(maskW, maskH) * 0.25));

  let boxX = Math.max(0, minX - pad);
  let boxY = Math.max(0, minY - pad);
  let boxW = Math.min(imgW - boxX, maskW + pad * 2);
  let boxH = Math.min(imgH - boxY, maskH + pad * 2);

  // 3. Make the crop box square to fit LaMa input without aspect ratio distortion
  const boxSide = Math.max(boxW, boxH);
  
  // Center the square box as much as possible within boundaries
  if (boxW < boxSide) {
    const adjust = Math.min(boxX, Math.round((boxSide - boxW) / 2));
    boxX = Math.max(0, boxX - adjust);
    boxW = Math.min(imgW - boxX, boxSide);
  }
  if (boxH < boxSide) {
    const adjust = Math.min(boxY, Math.round((boxSide - boxH) / 2));
    boxY = Math.max(0, boxY - adjust);
    boxH = Math.min(imgH - boxY, boxSide);
  }

  // 4. Setup the cropped 512x512 inputs
  const inputTempCanvas = new OffscreenCanvas(512, 512);
  const inputCtx = inputTempCanvas.getContext('2d');
  inputCtx.clearRect(0, 0, 512, 512);
  inputCtx.drawImage(originalCanvas, boxX, boxY, boxW, boxH, 0, 0, 512, 512);
  
  const maskTempCanvas = new OffscreenCanvas(512, 512);
  const maskCtx = maskTempCanvas.getContext('2d');
  maskCtx.fillStyle = 'black';
  maskCtx.fillRect(0, 0, 512, 512);
  maskCtx.drawImage(maskCanvas, boxX, boxY, boxW, boxH, 0, 0, 512, 512);

  const imageData = inputCtx.getImageData(0, 0, 512, 512);
  const maskImageData = maskCtx.getImageData(0, 0, 512, 512);

  return {
    imageData,
    maskImageData,
    padParams: { boxX, boxY, boxW, boxH, imgW, imgH }
  };
}

/**
 * Reconstruct the 512x512 inpainted crop back onto the high-resolution source image.
 */
export function composeInpaintOutput(outputBuffer, padParams, originalCanvas, maskCanvas) {
  const { boxX, boxY, boxW, boxH, imgW, imgH } = padParams;
  const finalImageData = new ImageData(outputBuffer, 512, 512);
  
  const outTempCanvas = new OffscreenCanvas(512, 512);
  const outTempCtx = outTempCanvas.getContext('2d');
  outTempCtx.putImageData(finalImageData, 0, 0);
  
  const finalOutCanvas = document.createElement('canvas');
  finalOutCanvas.width = imgW;
  finalOutCanvas.height = imgH;
  const finalCtx = finalOutCanvas.getContext('2d');
  
  // 1. Draw the original high-resolution image
  finalCtx.drawImage(originalCanvas, 0, 0);

  // 2. Scale the inpainted 512x512 crop back to its original cropped size
  const inpaintedScaleCanvas = document.createElement('canvas');
  inpaintedScaleCanvas.width = boxW;
  inpaintedScaleCanvas.height = boxH;
  const inpaintedScaleCtx = inpaintedScaleCanvas.getContext('2d');
  inpaintedScaleCtx.drawImage(outTempCanvas, 0, 0, 512, 512, 0, 0, boxW, boxH);

  // 3. Build a binary alpha mask from the original high-res mask for compositing
  const alphaMaskCanvas = document.createElement('canvas');
  alphaMaskCanvas.width = boxW;
  alphaMaskCanvas.height = boxH;
  const alphaMaskCtx = alphaMaskCanvas.getContext('2d');
  alphaMaskCtx.drawImage(maskCanvas, boxX, boxY, boxW, boxH, 0, 0, boxW, boxH);

  const maskPixels = alphaMaskCtx.getImageData(0, 0, boxW, boxH);
  const d = maskPixels.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i + 3] = isMaskPixel(d, i) ? 255 : 0;
  }
  alphaMaskCtx.putImageData(maskPixels, 0, 0);

  // 4. Clip the upscale inpainted result to only the masked region
  const maskedInpaintCanvas = document.createElement('canvas');
  maskedInpaintCanvas.width = boxW;
  maskedInpaintCanvas.height = boxH;
  const maskedInpaintCtx = maskedInpaintCanvas.getContext('2d');
  maskedInpaintCtx.drawImage(inpaintedScaleCanvas, 0, 0);
  maskedInpaintCtx.globalCompositeOperation = 'destination-in';
  maskedInpaintCtx.drawImage(alphaMaskCanvas, 0, 0);

  // 5. Composite back onto the original high-resolution image at the correct coordinates
  finalCtx.drawImage(maskedInpaintCanvas, boxX, boxY);
  
  return finalOutCanvas;
}


// ===========================================================================
// BACKGROUND WORKER HELPERS
// ===========================================================================

export function getMeta(meta, name, idx) {
  if (!meta) return undefined;
  if (Array.isArray(meta)) return meta[idx];
  if (typeof meta === 'object' && meta !== null) return meta[name];
  return undefined;
}

export function getDims(meta) {
  if (!meta) return undefined;
  if (Array.isArray(meta.dimensions)) return meta.dimensions;
  if (Array.isArray(meta.dims)) return meta.dims;
  return undefined;
}

export function detectLayout(dims) {
  if (dims && dims.length === 4) {
    if (dims[3] === 3) return 'NHWC';
    if (dims[1] === 3) return 'NCHW';
  }
  return 'NCHW';
}

export function normalizeDims(dims, channels) {
  if (!dims || !dims.length) return [1, channels, 512, 512];
  const fixed = dims.slice();
  const layout = detectLayout(dims);
  for (let i = 0; i < fixed.length; i++) {
    if (fixed[i] === -1 || fixed[i] === null || typeof fixed[i] === 'undefined') {
      if (i === 0) fixed[i] = 1;
      else if (layout === 'NCHW' && i === 1) fixed[i] = channels;
      else if (layout === 'NHWC' && i === 3) fixed[i] = channels;
      else fixed[i] = 512;
    }
  }
  return fixed;
}

/**
 * Normalizes and packs raw image and mask pixels into Float32 target arrays.
 */
export function packLamaTensors(image, mask, imageTensorData, maskTensorData, isNHWC) {
  const len = 512 * 512;
  const inv255 = 1.0 / 255.0;
  if (isNHWC) {
    for (let i = 0; i < len; i++) {
      const pi = i * 4;
      imageTensorData[i * 3] = image[pi] * inv255;
      imageTensorData[i * 3 + 1] = image[pi + 1] * inv255;
      imageTensorData[i * 3 + 2] = image[pi + 2] * inv255;
      // Set to 1.0 if pixel falls inside active mask, else 0.0
      maskTensorData[i] = isMaskPixel(mask, pi) ? 1.0 : 0.0;
    }
  } else {
    const ch2_offset = len;
    const ch3_offset = len * 2;
    for (let i = 0; i < len; i++) {
      const pi = i * 4;
      imageTensorData[i] = image[pi] * inv255;
      imageTensorData[i + ch2_offset] = image[pi + 1] * inv255;
      imageTensorData[i + ch3_offset] = image[pi + 2] * inv255;
      // Set to 1.0 if pixel falls inside active mask, else 0.0
      maskTensorData[i] = isMaskPixel(mask, pi) ? 1.0 : 0.0;
    }
  }
}

/**
 * Unpacks the Float32 model outputs and dynamically blends inpainted pixels 
 * back onto the original image canvas buffer using options.strength.
 */
export function unpackLamaOutput(finalData, mask, image, strength, scaleMode, isOutNHWC) {
  const len = 512 * 512;
  const ch2 = 262144;
  const ch3 = 524288;

  let min = finalData[0];
  let max = finalData[0];
  const outLen = finalData.length;
  for (let i = 1; i < outLen; i++) {
    const val = finalData[i];
    if (val < min) min = val;
    else if (val > max) max = val;
  }
  const range = max - min;

  if (isOutNHWC) {
    if (scaleMode === 1) {
      for (let i = 0; i < len; i++) {
        const pi = i * 4;
        if (!isMaskPixel(mask, pi)) continue;
        const idx = i * 3;
        const r = (finalData[idx] + 1.0) * 127.5;
        const g = (finalData[idx + 1] + 1.0) * 127.5;
        const b = (finalData[idx + 2] + 1.0) * 127.5;
        image[pi] = image[pi] * (1.0 - strength) + r * strength;
        image[pi + 1] = image[pi + 1] * (1.0 - strength) + g * strength;
        image[pi + 2] = image[pi + 2] * (1.0 - strength) + b * strength;
      }
    } else if (scaleMode === 2) {
      for (let i = 0; i < len; i++) {
        const pi = i * 4;
        if (!isMaskPixel(mask, pi)) continue;
        const idx = i * 3;
        const r = finalData[idx] * 255.0;
        const g = finalData[idx + 1] * 255.0;
        const b = finalData[idx + 2] * 255.0;
        image[pi] = image[pi] * (1.0 - strength) + r * strength;
        image[pi + 1] = image[pi + 1] * (1.0 - strength) + g * strength;
        image[pi + 2] = image[pi + 2] * (1.0 - strength) + b * strength;
      }
    } else if (scaleMode === 3) {
      for (let i = 0; i < len; i++) {
        const pi = i * 4;
        if (!isMaskPixel(mask, pi)) continue;
        const idx = i * 3;
        const r = finalData[idx];
        const g = finalData[idx + 1];
        const b = finalData[idx + 2];
        image[pi] = image[pi] * (1.0 - strength) + r * strength;
        image[pi + 1] = image[pi + 1] * (1.0 - strength) + g * strength;
        image[pi + 2] = image[pi + 2] * (1.0 - strength) + b * strength;
      }
    } else {
      const invRange = 1.0 / (range || 1);
      for (let i = 0; i < len; i++) {
        const pi = i * 4;
        if (!isMaskPixel(mask, pi)) continue;
        const idx = i * 3;
        const r = (finalData[idx] - min) * invRange * 255.0;
        const g = (finalData[idx + 1] - min) * invRange * 255.0;
        const b = (finalData[idx + 2] - min) * invRange * 255.0;
        image[pi] = image[pi] * (1.0 - strength) + r * strength;
        image[pi + 1] = image[pi + 1] * (1.0 - strength) + g * strength;
        image[pi + 2] = image[pi + 2] * (1.0 - strength) + b * strength;
      }
    }
  } else {
    if (scaleMode === 1) {
      for (let i = 0; i < len; i++) {
        const pi = i * 4;
        if (!isMaskPixel(mask, pi)) continue;
        const r = (finalData[i] + 1.0) * 127.5;
        const g = (finalData[i + ch2] + 1.0) * 127.5;
        const b = (finalData[i + ch3] + 1.0) * 127.5;
        image[pi] = image[pi] * (1.0 - strength) + r * strength;
        image[pi + 1] = image[pi + 1] * (1.0 - strength) + g * strength;
        image[pi + 2] = image[pi + 2] * (1.0 - strength) + b * strength;
      }
    } else if (scaleMode === 2) {
      for (let i = 0; i < len; i++) {
        const pi = i * 4;
        if (!isMaskPixel(mask, pi)) continue;
        const r = finalData[i] * 255.0;
        const g = finalData[i + ch2] * 255.0;
        const b = finalData[i + ch3] * 255.0;
        image[pi] = image[pi] * (1.0 - strength) + r * strength;
        image[pi + 1] = image[pi + 1] * (1.0 - strength) + g * strength;
        image[pi + 2] = image[pi + 2] * (1.0 - strength) + b * strength;
      }
    } else if (scaleMode === 3) {
      for (let i = 0; i < len; i++) {
        const pi = i * 4;
        if (!isMaskPixel(mask, pi)) continue;
        const r = finalData[i];
        const g = finalData[i + ch2];
        const b = finalData[i + ch3];
        image[pi] = image[pi] * (1.0 - strength) + r * strength;
        image[pi + 1] = image[pi + 1] * (1.0 - strength) + g * strength;
        image[pi + 2] = image[pi + 2] * (1.0 - strength) + b * strength;
      }
    } else {
      const invRange = 1.0 / (range || 1);
      for (let i = 0; i < len; i++) {
        const pi = i * 4;
        if (!isMaskPixel(mask, pi)) continue;
        const r = (finalData[i] - min) * invRange * 255.0;
        const g = (finalData[i + ch2] - min) * invRange * 255.0;
        const b = (finalData[i + ch3] - min) * invRange * 255.0;
        image[pi] = image[pi] * (1.0 - strength) + r * strength;
        image[pi + 1] = image[pi + 1] * (1.0 - strength) + g * strength;
        image[pi + 2] = image[pi + 2] * (1.0 - strength) + b * strength;
      }
    }
  }
}
