/**
 * Helper utilities for the Magic Erase service.
 * Handles dimensional normalization, tensor packing, and canvas composition 
 * for LaMa inpainting on both the main thread and background worker.
 */

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
  const aspect = imgW / imgH;

  let targetW, targetH, padX, padY;
  if (aspect > 1) { // Landscape
    targetW = 512;
    targetH = Math.round(512 / aspect);
    padX = 0;
    padY = Math.floor((512 - targetH) / 2);
  } else { // Portrait
    targetH = 512;
    targetW = Math.round(512 * aspect);
    padY = 0;
    padX = Math.floor((512 - targetW) / 2);
  }

  // Setup the 512x512 inputs
  const inputTempCanvas = new OffscreenCanvas(512, 512);
  const inputCtx = inputTempCanvas.getContext('2d');
  inputCtx.clearRect(0, 0, 512, 512);
  inputCtx.drawImage(originalCanvas, padX, padY, targetW, targetH);
  
  const maskTempCanvas = new OffscreenCanvas(512, 512);
  const maskCtx = maskTempCanvas.getContext('2d');
  maskCtx.fillStyle = 'black';
  maskCtx.fillRect(0, 0, 512, 512);
  maskCtx.globalAlpha = 1.0;
  maskCtx.drawImage(maskCanvas, padX, padY, targetW, targetH);

  const imageData = inputCtx.getImageData(0, 0, 512, 512);
  const maskImageData = maskCtx.getImageData(0, 0, 512, 512);

  return {
    imageData,
    maskImageData,
    padParams: { padX, padY, targetW, targetH, imgW, imgH }
  };
}

/**
 * Reconstruct the 512x512 inpainted buffer back onto the original high-resolution canvas,
 * removing the aspect ratio padding.
 * 
 * @param {Uint8ClampedArray} outputBuffer Raw inpainted pixel buffer from worker
 * @param {Object} padParams Mapping variables
 * @returns {HTMLCanvasElement} Restored high-res canvas
 */
export function composeInpaintOutput(outputBuffer, padParams) {
  const { padX, padY, targetW, targetH, imgW, imgH } = padParams;
  const finalImageData = new ImageData(outputBuffer, 512, 512);
  
  const outTempCanvas = new OffscreenCanvas(512, 512);
  const outTempCtx = outTempCanvas.getContext('2d');
  outTempCtx.putImageData(finalImageData, 0, 0);
  
  const finalOutCanvas = document.createElement('canvas');
  finalOutCanvas.width = imgW;
  finalOutCanvas.height = imgH;
  const finalCtx = finalOutCanvas.getContext('2d');
  
  // Map inverse padding
  finalCtx.drawImage(outTempCanvas, padX, padY, targetW, targetH, 0, 0, imgW, imgH);
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
      maskTensorData[i] = mask[pi] > 128 ? 1.0 : 0.0;
    }
  } else {
    const ch2_offset = len;
    const ch3_offset = len * 2;
    for (let i = 0; i < len; i++) {
      const pi = i * 4;
      imageTensorData[i] = image[pi] * inv255;
      imageTensorData[i + ch2_offset] = image[pi + 1] * inv255;
      imageTensorData[i + ch3_offset] = image[pi + 2] * inv255;
      maskTensorData[i] = mask[pi] > 128 ? 1.0 : 0.0;
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
        if (mask[pi] <= 128) continue;
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
        if (mask[pi] <= 128) continue;
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
        if (mask[pi] <= 128) continue;
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
        if (mask[pi] <= 128) continue;
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
        if (mask[pi] <= 128) continue;
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
        if (mask[pi] <= 128) continue;
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
        if (mask[pi] <= 128) continue;
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
        if (mask[pi] <= 128) continue;
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
