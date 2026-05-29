/**
 * Helper utilities for post-processing in the Background Removal service.
 * Handles CPU-intensive alpha channel extraction and morphological operations (erode/dilate).
 */

/**
 * Extract the alpha channel from canvas ImageData.
 */
export function extractAlphaChannel(imageData, W, H) {
  const out = new Uint8ClampedArray(W * H);
  const d = imageData.data;
  for (let i = 0; i < W * H; i++) {
    out[i] = d[i * 4 + 3];
  }
  return out;
}

/**
 * Write the processed alpha channel back into canvas ImageData.
 */
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
