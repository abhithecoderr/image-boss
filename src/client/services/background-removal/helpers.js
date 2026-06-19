/*
 * Consolidated helper utilities for the Background Removal service.
 * Handles morphological operations, main-thread canvas masking, and worker-side alpha mask creation.
 * Cross-runtime safe to run in both main and Web Worker threads.
 */

import { createCanvas, canvasCache } from "../../utils/canvas-utils.js";

// Extract the alpha channel from canvas ImageData
export function extractAlphaChannel(imageData, W, H) {
  const out = new Uint8ClampedArray(W * H);
  const d = imageData.data;
  for (let i = 0; i < W * H; i++) {
    out[i] = d[i * 4 + 3];
  }
  return out;
}

// Write the processed alpha channel back into canvas ImageData
export function writeAlphaChannel(imageData, alpha, W, H) {
  const d = imageData.data;
  for (let i = 0; i < W * H; i++) {
    d[i * 4 + 3] = alpha[i];
  }
}

/**
 * Morphological erode/dilate on alpha channel using a circular kernel.
 * Labeled loops and early exits optimize runtime complexity.
 */
export function morphAlpha(alpha, W, H, radius, mode) {
  const out = new Uint8ClampedArray(W * H);
  const r = Math.ceil(radius);
  if (r <= 0) {
    out.set(alpha);
    return out;
  }

  // Precompute offsets for circular kernel (relative index offsets)
  const offsets = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        offsets.push(dy * W + dx);
      }
    }
  }
  const numOffsets = offsets.length;

  // Compute inner boundaries
  const xMin = r;
  const xMax = W - r;
  const yMin = r;
  const yMax = H - r;

  // 1. Process Interior (fast loop: boundary checks completely eliminated)
  if (xMax > xMin && yMax > yMin) {
    for (let y = yMin; y < yMax; y++) {
      const pixelOffset = y * W;
      for (let x = xMin; x < xMax; x++) {
        const idx = pixelOffset + x;
        let val = mode === 'erode' ? 255 : 0;
        
        if (mode === 'erode') {
          for (let i = 0; i < numOffsets; i++) {
            const v = alpha[idx + offsets[i]];
            if (v < val) {
              val = v;
              if (val === 0) break;
            }
          }
        } else {
          for (let i = 0; i < numOffsets; i++) {
            const v = alpha[idx + offsets[i]];
            if (v > val) {
              val = v;
              if (val === 255) break;
            }
          }
        }
        out[idx] = val;
      }
    }
  }

  // 2. Process Borders (requires boundary check safety guards)
  const borderOffsets = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        borderOffsets.push({ dx, dy, offset: dy * W + dx });
      }
    }
  }
  const numBorderOffsets = borderOffsets.length;

  const processBorderPixel = (x, y) => {
    const idx = y * W + x;
    let val = mode === 'erode' ? 255 : 0;
    for (let i = 0; i < numBorderOffsets; i++) {
      const k = borderOffsets[i];
      const nx = x + k.dx;
      if (nx < 0 || nx >= W) continue;
      const ny = y + k.dy;
      if (ny < 0 || ny >= H) continue;
      
      const v = alpha[idx + k.offset];
      if (mode === 'erode') {
        if (v < val) {
          val = v;
          if (val === 0) break;
        }
      } else {
        if (v > val) {
          val = v;
          if (val === 255) break;
        }
      }
    }
    out[idx] = val;
  };

  // Top/Bottom border rows
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < yMin; y++) processBorderPixel(x, y);
    for (let y = Math.max(0, yMax); y < H; y++) processBorderPixel(x, y);
  }
  // Left/Right border columns
  for (let y = yMin; y < yMax; y++) {
    for (let x = 0; x < xMin; x++) processBorderPixel(x, y);
    for (let x = Math.max(0, xMax); x < W; x++) processBorderPixel(x, y);
  }

  return out;
}

/**
 * Apply mask result to a source canvas with pixel-level post-processing.
 * Uses native canvas filters for accelerated smoothness and contrast, and morphological CPU fallback for edge shifting.
 */
export function applyMaskToCanvas(sourceCanvas, maskResult, options = {}) {
  if (!sourceCanvas) return null;
  const { resultBitmap } = maskResult;
  const W = sourceCanvas.width;
  const H = sourceCanvas.height;

  // Extract post-processing options
  const edgeShift = Number(options.edgeShift) || 0;
  const edgeSmoothness = Number(options.edgeSmoothness) || 0;
  const edgeContrast = Number(options.edgeContrast) || 0;
  const needsPostProcess = edgeShift !== 0 || edgeSmoothness !== 0 || edgeContrast !== 0;

  // 1. Render the AI mask bitmap to a temp scratch canvas at MODEL native resolution
  const maskW = resultBitmap.width;
  const maskH = resultBitmap.height;

  const { canvas: maskCanvas, ctx: maskCtx } = canvasCache.get('bg_mask', maskW, maskH);
  maskCtx.clearRect(0, 0, maskW, maskH);

  // 2. Apply post-processing to the mask
  if (needsPostProcess) {
    if (edgeShift !== 0) {
      // Erode/Dilate requires CPU morphological operations
      maskCtx.drawImage(resultBitmap, 0, 0, maskW, maskH);
      const maskData = maskCtx.getImageData(0, 0, maskW, maskH);
      const alpha = extractAlphaChannel(maskData, maskW, maskH);
      
      const radius = Math.abs(edgeShift);
      const processed = edgeShift < 0
        ? morphAlpha(alpha, maskW, maskH, radius, 'erode')
        : morphAlpha(alpha, maskW, maskH, radius, 'dilate');

      writeAlphaChannel(maskData, processed, maskW, maskH);
      maskCtx.putImageData(maskData, 0, 0);
    } else {
      maskCtx.drawImage(resultBitmap, 0, 0, maskW, maskH);
    }

    // Apply Blur and Contrast using hardware-accelerated Canvas Filters
    if (edgeSmoothness > 0 || edgeContrast > 0) {
      const { canvas: filterCanvas, ctx: filterCtx } = canvasCache.get('bg_filter', maskW, maskH);
      filterCtx.clearRect(0, 0, maskW, maskH);
      
      const blur = edgeSmoothness > 0 ? `blur(${edgeSmoothness}px)` : '';
      const contrast = edgeContrast > 0 ? `contrast(${100 + edgeContrast * 25}%)` : '';
      filterCtx.filter = [blur, contrast].filter(Boolean).join(' ');
      filterCtx.drawImage(maskCanvas, 0, 0);
      
      maskCtx.clearRect(0, 0, maskW, maskH);
      maskCtx.drawImage(filterCanvas, 0, 0);
    }
  } else {
    maskCtx.drawImage(resultBitmap, 0, 0, maskW, maskH);
  }

  // 3. Composite: source image masked by the (possibly modified) mask
  const resultCanvas = createCanvas(W, H);
  const ctx = resultCanvas.getContext('2d');

  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  // Hardware bilinear scaling handles high-quality upscale to full canvas dimensions instantly!
  ctx.drawImage(maskCanvas, 0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  return resultCanvas;
}

/**
 * Converts a raw image (from Transformers.js output) to an ImageBitmap representing the alpha mask.
 */
export async function createAlphaMaskFromRawImage(rawImage) {
  const w = rawImage.width;
  const h = rawImage.height;
  const maskData = rawImage.data;
  const channels = rawImage.channels || Math.round(maskData.length / (w * h));

  const { canvas: maskCanvas, ctx: maskCtx } = canvasCache.get('bg_alpha', w, h);
  maskCtx.clearRect(0, 0, w, h);
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

/**
 * Drop the module-level canvas/ctx caches so their backing stores can be GC'd
 * when the worker is being disposed. Called from the worker's `dispose` path.
 */
export function releaseHelperCaches() {
  canvasCache.clear();
}
