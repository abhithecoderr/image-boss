/**
 * Architectural Helpers for Super-Resolution Upscaling Service
 * Contains downloading, filter-pipeline, tiling edge-clamping, and tensor processing.
 */

export const DEFAULT_DETAILS_INTENSITY = 0.5;
export const DEFAULT_BRIGHTNESS = 0;
export const DEFAULT_SATURATION = 0;

// Module-level persistent cache for GPU-accelerated canvas filter pipeline
let filterBaseCanvas = null;
let filterBaseCtx = null;

/**
 * Downloads a binary resource (model, weights, etc.) with progressive progress reporting
 */
export async function fetchWithProgress(url, label, report, startWeight, endWeight) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${label}: ${response.statusText}`);

  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body.getReader();
  const chunks = [];
  const reportProgress = report(startWeight, endWeight, `Downloading ${label}...`);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;

    if (total) {
      reportProgress((loaded / total) * 100);
    }
  }

  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Renders an overlapping tile from a source bitmap, clamping margins to boundary pixels
 * to avoid artificial dark/light grid seams around image edges.
 */
export function prepareTile(tile, processingBitmap, imgW, imgH, overlap, inputSize, tileCtx) {
  const sx = tile.x - overlap;
  const sy = tile.y - overlap;

  tileCtx.clearRect(0, 0, inputSize, inputSize);
  tileCtx.drawImage(processingBitmap, sx, sy, inputSize, inputSize, 0, 0, inputSize, inputSize);

  // Edge Clamping
  if (sx < 0) {
    tileCtx.drawImage(processingBitmap, 0, sy, 1, inputSize, 0, 0, -sx, inputSize);
  }
  if (sy < 0) {
    tileCtx.drawImage(processingBitmap, sx, 0, inputSize, 1, 0, 0, inputSize, -sy);
  }
  if (sx + inputSize > imgW) {
    const over = (sx + inputSize) - imgW;
    tileCtx.drawImage(processingBitmap, imgW - 1, sy, 1, inputSize, inputSize - over, 0, over, inputSize);
  }
  if (sy + inputSize > imgH) {
    const over = (sy + inputSize) - imgH;
    tileCtx.drawImage(processingBitmap, sx, imgH - 1, inputSize, 1, 0, inputSize - over, over, 1);
  }
}

/**
 * Packs 4-channel pixel data array (RGBA) into standard planar RGB Float32Array
 * expected by Real-ESRGAN model.
 */
export function packInputTensor(imageData, inputSize) {
  const inputTensorData = new Float32Array(3 * inputSize * inputSize);
  const totalPixels = inputSize * inputSize;

  for (let i = 0; i < totalPixels; i++) {
    const pIdx = i * 4;
    inputTensorData[i] = imageData[pIdx] / 255.0;
    inputTensorData[totalPixels + i] = imageData[pIdx + 1] / 255.0;
    inputTensorData[2 * totalPixels + i] = imageData[pIdx + 2] / 255.0;
  }

  return inputTensorData;
}

/**
 * Unpacks the model's planar RGB float32 output into standard 4-channel RGBA ImageData
 */
export function unpackOutputTensor(outputData, outSize) {
  const outChannelSize = outSize * outSize;
  const rImageData = new ImageData(outSize, outSize);
  const rPixels = new Uint32Array(rImageData.data.buffer);

  for (let i = 0; i < outChannelSize; i++) {
    const r = Math.max(0, Math.min(255, Math.round(outputData[0 * outChannelSize + i] * 255.0)));
    const g = Math.max(0, Math.min(255, Math.round(outputData[1 * outChannelSize + i] * 255.0)));
    const b = Math.max(0, Math.min(255, Math.round(outputData[2 * outChannelSize + i] * 255.0)));
    rPixels[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }

  return rImageData;
}

/**
 * Performs frequency separation texture enhancement and brightness/saturation adjustment
 * entirely on OffscreenCanvas (avoiding slow pixel-by-pixel JS loops).
 */
export async function applyFilters(aiCanvas, originalBitmap, params, progressCallback) {
  const {
    detailsIntensity = DEFAULT_DETAILS_INTENSITY,
    brightness = DEFAULT_BRIGHTNESS,
    saturation = DEFAULT_SATURATION,
    targetScale
  } = params;

  const outW = aiCanvas.width;
  const outH = aiCanvas.height;

  if (!filterBaseCanvas || filterBaseCanvas.width !== outW || filterBaseCanvas.height !== outH) {
    filterBaseCanvas = new OffscreenCanvas(outW, outH);
    filterBaseCtx = filterBaseCanvas.getContext('2d');
  }

  // 1. BASE: The AI result provides high-frequency structure
  filterBaseCtx.clearRect(0, 0, outW, outH);
  filterBaseCtx.drawImage(aiCanvas, 0, 0);

  // 2. DETAILS ENHANCEMENT via GPU-Accelerated Unsharp Mask
  if (detailsIntensity > 0) {
    progressCallback?.(0.96, 'Restoring textures via GPU...');

    filterBaseCtx.save();
    filterBaseCtx.globalAlpha = detailsIntensity * 0.4;
    filterBaseCtx.globalCompositeOperation = 'overlay';
    filterBaseCtx.drawImage(originalBitmap, 0, 0, outW, outH);
    filterBaseCtx.restore();
  }

  // 3. BRIGHTNESS & SATURATION via Hardware Filters
  if (brightness !== 0 || saturation !== 0) {
    const bPerc = 100 + (brightness * 100);
    const sPerc = 100 + (saturation * 100);

    const filterCanvas = new OffscreenCanvas(outW, outH);
    const fCtx = filterCanvas.getContext('2d');
    fCtx.filter = `brightness(${bPerc}%) saturate(${sPerc}%)`;
    fCtx.drawImage(filterBaseCanvas, 0, 0);

    filterBaseCtx.clearRect(0, 0, outW, outH);
    filterBaseCtx.drawImage(filterCanvas, 0, 0);
  }

  // Final Scale Adjustment (if fractional scale requested)
  const targetWidth = Math.round(originalBitmap.width * targetScale);
  const targetHeight = Math.round(originalBitmap.height * targetScale);

  let resultCanvas = filterBaseCanvas;
  if (outW !== targetWidth || outH !== targetHeight) {
    const resizer = new OffscreenCanvas(targetWidth, targetHeight);
    const rCtx = resizer.getContext('2d');
    rCtx.imageSmoothingEnabled = true;
    rCtx.imageSmoothingQuality = 'high';
    rCtx.drawImage(filterBaseCanvas, 0, 0, targetWidth, targetHeight);
    resultCanvas = resizer;
  }

  return await createImageBitmap(resultCanvas);
}
