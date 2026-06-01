/**
 * Helper utilities for post-processing in the Background Removal service.
 * Handles CPU-intensive alpha channel extraction and morphological operations (erode/dilate).
 */

//  Extract the alpha channel from canvas ImageData
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
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let val = mode === 'erode' ? 255 : 0;
      outer: for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          if (dx * dx + dy * dy > r * r) continue; // circular kernel
          const v = alpha[ny * W + nx];
          if (mode === 'erode') {
            if (v < val) val = v;
            if (val === 0) break outer; // Early exit: cannot get below 0
          } else {
            if (v > val) val = v;
            if (val === 255) break outer; // Early exit: cannot get above 255
          }
        }
      }
      out[y * W + x] = val;
    }
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

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskW;
  maskCanvas.height = maskH;
  const maskCtx = maskCanvas.getContext('2d');

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
      const filterCanvas = document.createElement('canvas');
      filterCanvas.width = maskW;
      filterCanvas.height = maskH;
      const filterCtx = filterCanvas.getContext('2d');
      
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
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = W;
  resultCanvas.height = H;
  const ctx = resultCanvas.getContext('2d');

  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  // Hardware bilinear scaling handles high-quality upscale to full canvas dimensions instantly!
  ctx.drawImage(maskCanvas, 0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  return resultCanvas;
}

