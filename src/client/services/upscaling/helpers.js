// Helpers for Super-Resolution Upscaling Service
// Contains downloading, tiling edge-clamping, and tensor processing.


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

  const srcX = Math.max(0, sx);
  const srcY = Math.max(0, sy);
  const srcW = Math.min(imgW, sx + inputSize) - srcX;
  const srcH = Math.min(imgH, sy + inputSize) - srcY;
  const dstX = srcX - sx;
  const dstY = srcY - sy;

  tileCtx.clearRect(0, 0, inputSize, inputSize);

  // Draw main image portion (fully within bounds)
  tileCtx.drawImage(processingBitmap, srcX, srcY, srcW, srcH, dstX, dstY, srcW, srcH);

  // Edge Clamping
  if (sx < 0) {
    // Left edge (replicate column 0)
    tileCtx.drawImage(processingBitmap, 0, srcY, 1, srcH, 0, dstY, dstX, srcH);
  }
  if (sy < 0) {
    // Top edge (replicate row 0)
    tileCtx.drawImage(processingBitmap, srcX, 0, srcW, 1, dstX, 0, srcW, dstY);
  }
  if (sx + inputSize > imgW) {
    // Right edge (replicate column imgW - 1)
    const overX = (sx + inputSize) - imgW;
    tileCtx.drawImage(processingBitmap, imgW - 1, srcY, 1, srcH, dstX + srcW, dstY, overX, srcH);
  }
  if (sy + inputSize > imgH) {
    // Bottom edge (replicate row imgH - 1)
    const overY = (sy + inputSize) - imgH;
    tileCtx.drawImage(processingBitmap, srcX, imgH - 1, srcW, 1, dstX, dstY + srcH, srcW, overY);
  }

  // Corner Clamping
  if (sx < 0 && sy < 0) {
    // Top-left corner
    tileCtx.drawImage(processingBitmap, 0, 0, 1, 1, 0, 0, dstX, dstY);
  }
  if (sx + inputSize > imgW && sy < 0) {
    // Top-right corner
    const overX = (sx + inputSize) - imgW;
    tileCtx.drawImage(processingBitmap, imgW - 1, 0, 1, 1, dstX + srcW, 0, overX, dstY);
  }
  if (sx < 0 && sy + inputSize > imgH) {
    // Bottom-left corner
    const overY = (sy + inputSize) - imgH;
    tileCtx.drawImage(processingBitmap, 0, imgH - 1, 1, 1, 0, dstY + srcH, dstX, overY);
  }
  if (sx + inputSize > imgW && sy + inputSize > imgH) {
    // Bottom-right corner
    const overX = (sx + inputSize) - imgW;
    const overY = (sy + inputSize) - imgH;
    tileCtx.drawImage(processingBitmap, imgW - 1, imgH - 1, 1, 1, dstX + srcW, dstY + srcH, overX, overY);
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
 * Packs 4-channel pixel data array (RGBA) into standard interleaved RGB NHWC Float32Array
 */
export function packInputTensorNHWC(imageData, inputSize) {
  const inputTensorData = new Float32Array(3 * inputSize * inputSize);
  const totalPixels = inputSize * inputSize;

  for (let i = 0; i < totalPixels; i++) {
    const pIdx = i * 4;
    const tIdx = i * 3;
    inputTensorData[tIdx] = imageData[pIdx] / 255.0;
    inputTensorData[tIdx + 1] = imageData[pIdx + 1] / 255.0;
    inputTensorData[tIdx + 2] = imageData[pIdx + 2] / 255.0;
  }

  return inputTensorData;
}

/**
 * Unpacks the model's interleaved RGB float32 output into standard 4-channel RGBA ImageData
 */
export function unpackOutputTensorNHWC(outputData, outSize) {
  const outChannelSize = outSize * outSize;
  const rImageData = new ImageData(outSize, outSize);
  const rPixels = new Uint32Array(rImageData.data.buffer);

  for (let i = 0; i < outChannelSize; i++) {
    const tIdx = i * 3;
    const r = Math.max(0, Math.min(255, Math.round(outputData[tIdx] * 255.0)));
    const g = Math.max(0, Math.min(255, Math.round(outputData[tIdx + 1] * 255.0)));
    const b = Math.max(0, Math.min(255, Math.round(outputData[tIdx + 2] * 255.0)));
    rPixels[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  }

  return rImageData;
}

/**
 * Optimized direct CPU-based tile packing (Planar / NCHW)
 */
export function packTilePlanar(originalImageData, imgW, imgH, tileX, tileY, overlap, inputSize, outputTensorData) {
  const totalPixels = inputSize * inputSize;
  for (let py = 0; py < inputSize; py++) {
    const srcY = Math.max(0, Math.min(imgH - 1, tileY - overlap + py));
    const rowOffset = srcY * imgW;
    const destRowOffset = py * inputSize;
    for (let px = 0; px < inputSize; px++) {
      const srcX = Math.max(0, Math.min(imgW - 1, tileX - overlap + px));
      const idx = (rowOffset + srcX) * 4;
      const tIdx = destRowOffset + px;

      outputTensorData[tIdx] = originalImageData[idx] / 255.0;
      outputTensorData[totalPixels + tIdx] = originalImageData[idx + 1] / 255.0;
      outputTensorData[2 * totalPixels + tIdx] = originalImageData[idx + 2] / 255.0;
    }
  }
}

/**
 * Optimized direct CPU-based tile packing (Interleaved / NHWC)
 */
export function packTileNHWC(originalImageData, imgW, imgH, tileX, tileY, overlap, inputSize, outputTensorData) {
  for (let py = 0; py < inputSize; py++) {
    const srcY = Math.max(0, Math.min(imgH - 1, tileY - overlap + py));
    const rowOffset = srcY * imgW;
    const destRowOffset = py * inputSize;
    for (let px = 0; px < inputSize; px++) {
      const srcX = Math.max(0, Math.min(imgW - 1, tileX - overlap + px));
      const idx = (rowOffset + srcX) * 4;
      const tIdx = (destRowOffset + px) * 3;

      outputTensorData[tIdx] = originalImageData[idx] / 255.0;
      outputTensorData[tIdx + 1] = originalImageData[idx + 1] / 255.0;
      outputTensorData[tIdx + 2] = originalImageData[idx + 2] / 255.0;
    }
  }
}

/**
 * Optimized direct CPU-based tile unpacking (Planar / NCHW) to master output array
 */
export function unpackTilePlanar(outputData, outSize, outOverlap, outStride, masterData, outW, outH, startX, startY) {
  const outChannelSize = outSize * outSize;
  const targetRows = Math.min(outStride, outH - startY);
  const targetCols = Math.min(outStride, outW - startX);

  for (let py = 0; py < targetRows; py++) {
    const tileY = outOverlap + py;
    const masterY = startY + py;
    const tileRowOffset = tileY * outSize;
    const masterRowOffset = masterY * outW;

    for (let px = 0; px < targetCols; px++) {
      const tileX = outOverlap + px;
      const masterX = startX + px;

      const tIdx = tileRowOffset + tileX;
      const mIdx = (masterRowOffset + masterX) * 4;

      masterData[mIdx] = Math.max(0, Math.min(255, Math.round(outputData[tIdx] * 255.0)));
      masterData[mIdx + 1] = Math.max(0, Math.min(255, Math.round(outputData[outChannelSize + tIdx] * 255.0)));
      masterData[mIdx + 2] = Math.max(0, Math.min(255, Math.round(outputData[2 * outChannelSize + tIdx] * 255.0)));
      masterData[mIdx + 3] = 255;
    }
  }
}

/**
 * Optimized direct CPU-based tile unpacking (Interleaved / NHWC) to master output array
 */
export function unpackTileNHWC(outputData, outSize, outOverlap, outStride, masterData, outW, outH, startX, startY) {
  const targetRows = Math.min(outStride, outH - startY);
  const targetCols = Math.min(outStride, outW - startX);

  for (let py = 0; py < targetRows; py++) {
    const tileY = outOverlap + py;
    const masterY = startY + py;
    const tileRowOffset = tileY * outSize;
    const masterRowOffset = masterY * outW;

    for (let px = 0; px < targetCols; px++) {
      const tileX = outOverlap + px;
      const masterX = startX + px;

      const tIdx = (tileRowOffset + tileX) * 3;
      const mIdx = (masterRowOffset + masterX) * 4;

      masterData[mIdx] = Math.max(0, Math.min(255, Math.round(outputData[tIdx] * 255.0)));
      masterData[mIdx + 1] = Math.max(0, Math.min(255, Math.round(outputData[tIdx + 1] * 255.0)));
      masterData[mIdx + 2] = Math.max(0, Math.min(255, Math.round(outputData[tIdx + 2] * 255.0)));
      masterData[mIdx + 3] = 255;
    }
  }
}

