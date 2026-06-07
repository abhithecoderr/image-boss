/**
 * Worker-side helper utilities for Background Removal.
 * Runs inside the Web Worker context.
 */

/**
 * Converts a raw image (from Transformers.js output) to an ImageBitmap representing the alpha mask.
 * 
 * @param {object} rawImage - The raw image object containing data, width, height, and channels.
 * @returns {Promise<ImageBitmap>}
 */
export async function createAlphaMaskFromRawImage(rawImage) {
  const w = rawImage.width;
  const h = rawImage.height;
  const maskData = rawImage.data;
  const channels = rawImage.channels || Math.round(maskData.length / (w * h));

  const maskCanvas = new OffscreenCanvas(w, h);
  const maskCtx = maskCanvas.getContext("2d");
  const imgData = maskCtx.createImageData(w, h);
  const pixels = imgData.data;

  // Calculate stats to determine if values are in [0, 1] or [0, 255]
  let maxVal = -Infinity;
  const sampleLength = Math.min(maskData.length, 10000);
  for (let i = 0; i < sampleLength; i++) {
    const v = maskData[i];
    if (v > maxVal) maxVal = v;
  }

  const scale = (maxVal <= 1.0 && maxVal > 0.0) ? 255.0 : 1.0;

  if (channels === 4) {
    for (let i = 0; i < w * h; i++) {
      pixels[i * 4 + 3] = Math.round(maskData[i * 4 + 3] * scale); // Scale alpha channel
    }
  } else if (channels === 1) {
    for (let i = 0; i < w * h; i++) {
      pixels[i * 4 + 3] = Math.round(maskData[i] * scale); // Scale single channel grayscale to alpha
    }
  } else {
    // RGB or other: take R channel (or average) and scale
    for (let i = 0; i < w * h; i++) {
      pixels[i * 4 + 3] = Math.round(maskData[i * channels] * scale);
    }
  }

  maskCtx.putImageData(imgData, 0, 0);
  return await createImageBitmap(maskCanvas);
}

/**
 * Maps raw model output tensor values (logits, direct probabilities, or min-max normalization) to an alpha mask bitmap.
 * Reuses canvas and context to avoid garbage collection memory spikes.
 * 
 * @param {Float32Array|Float16Array} outputData - Model output tensor raw values
 * @param {number} size - Square size of the output
 * @param {string|boolean} outputType - The normalization/output type ('logit', 'probability', 'minmax', or boolean for backward compatibility)
 * @param {OffscreenCanvas} canvas - Cached canvas to draw on
 * @param {OffscreenCanvasRenderingContext2D} ctx - Cached context
 * @returns {Promise<ImageBitmap>}
 */
export async function createAlphaMaskFromTensors(outputData, size, outputType, canvas, ctx) {
  const totalPixels = size * size;
  const outImgData = ctx.createImageData(size, size);
  const outPixels = outImgData.data;

  let mode = outputType;
  if (typeof outputType === "boolean") {
    mode = outputType ? "logit" : "probability";
  }

  if (mode === "minmax") {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < totalPixels; i++) {
      const val = outputData[i];
      if (val < min) min = val;
      if (val > max) max = val;
    }
    const range = max - min + 1e-8;
    for (let i = 0; i < totalPixels; i++) {
      const val = outputData[i];
      const alpha = Math.round(((val - min) / range) * 255.0);
      outPixels[i * 4 + 3] = alpha;
    }
  } else {
    for (let i = 0; i < totalPixels; i++) {
      const val = outputData[i];
      let alpha;
      if (mode === "logit") {
        // Fast sigmoid calculation bypass for extreme values
        if (val > 5) {
          alpha = 255;
        } else if (val < -5) {
          alpha = 0;
        } else {
          alpha = Math.round((1.0 / (1.0 + Math.exp(-val))) * 255.0);
        }
      } else {
        // Direct probabilities in [0.0, 1.0] (e.g. BEN2 model)
        alpha = Math.round(Math.max(0.0, Math.min(1.0, val)) * 255.0);
      }
      outPixels[i * 4 + 3] = alpha; // Set the alpha channel
    }
  }

  ctx.putImageData(outImgData, 0, 0);
  return await createImageBitmap(canvas);
}
