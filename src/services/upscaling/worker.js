/**
 * Upscaling Worker using ONNX Runtime directly
 * Uses Real-ESRGAN model from HuggingFace (TheGuy444/Real-ESRGAN-ONNX)
 *
 * Supports Tile-based upscaling to handle any image size without loss or clipping.
 */

import * as ort from 'onnxruntime-web/webgpu';

// Configure ONNX Runtime for stability
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = false;

// Point to a reliable CDN for WASM files
const ORT_VERSION = '1.20.0';
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

const MODEL_ONNX_URL = 'https://huggingface.co/TheGuy444/Real-ESRGAN-ONNX/resolve/main/onnx/model.onnx';
const MODEL_DATA_URL = 'https://huggingface.co/TheGuy444/Real-ESRGAN-ONNX/resolve/main/onnx/model.data';
const MAX_INPUT_SIZE = 128; // Model expects exactly 128x128
const SCALE_FACTOR = 4;
const OVERLAP = 16;         // Standard overlap for Real-ESRGAN
const STRIDE = MAX_INPUT_SIZE - (OVERLAP * 2); // 96px

// Post-processing defaults (can be overridden from UI)
const DEFAULT_DETAILS_INTENSITY = 0.5;   // Unsharp mask strength (0-1)
const DEFAULT_BRIGHTNESS = 0;            // -0.3 to +0.3
const DEFAULT_SATURATION = 0;            // -0.3 to +0.3

let session = null;
let currentDevice = null;

async function fetchWithProgress(url, label, onProgress, startWeight, endWeight) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${label}: ${response.statusText}`);

  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;

    if (total) {
      const progress = startWeight + (loaded / total) * (endWeight - startWeight);
      onProgress?.(progress, `Downloading ${label}: ${Math.round((loaded / total) * 100)}%`);
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

async function getSession(onProgress) {
  if (session) return session;

  try {
    const modelBuffer = await fetchWithProgress(MODEL_ONNX_URL, 'model structure', onProgress, 0.05, 0.1);
    const dataBuffer = await fetchWithProgress(MODEL_DATA_URL, 'model weights', onProgress, 0.1, 0.3);

    const sessionOptions = {
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'all',
      externalData: [
        {
          path: 'model.data',
          data: new Uint8Array(dataBuffer),
        }
      ]
    };

    onProgress?.(0.3, 'Initializing Real-ESRGAN session...');

    try {
      session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
      currentDevice = 'webgpu';
    } catch (e) {
      console.warn('WebGPU failed, falling back to WASM:', e);
      session = await ort.InferenceSession.create(modelBuffer, {
        ...sessionOptions,
        executionProviders: ['wasm'],
      });
      currentDevice = 'wasm';
    }

    onProgress?.(0.4, 'Model ready');

    return session;

  } catch (err) {
    console.error('Failed to load session:', err);
    throw err;
  }
}

// Persistent cache for Hot-Refinement
let cachedAIResult = null;     // The raw tiled output (OffscreenCanvas)
let cachedOriginalBitmap = null; // The original input (ImageBitmap) for frequency separation
let cachedScale = null;
let cachedTurbo = null;

/**
 * Apply post-processing filters (Frequency Separation + Color Grading)
 * This runs in <200ms and can be called independently for "Hot-Refinement"
 */
async function applyFilters(aiCanvas, originalBitmap, params, progressCallback) {
  const { detailsIntensity = DEFAULT_DETAILS_INTENSITY, brightness = DEFAULT_BRIGHTNESS, saturation = DEFAULT_SATURATION, targetScale } = params;
  const outW = aiCanvas.width;
  const outH = aiCanvas.height;

  const finalCanvas = new OffscreenCanvas(outW, outH);
  const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });

  // 1. BASE: The AI result provides the sharp "geometry" and structure
  finalCtx.drawImage(aiCanvas, 0, 0);

  // 2. DETAILS ENHANCEMENT via Unsharp Mask
  if (detailsIntensity > 0) {
    progressCallback?.(0.96, 'Restoring textures...');
    const resultData = finalCtx.getImageData(0, 0, outW, outH);
    const rp = resultData.data;

    const origCanvas = new OffscreenCanvas(outW, outH);
    const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
    origCtx.imageSmoothingEnabled = true;
    origCtx.imageSmoothingQuality = 'high';
    origCtx.drawImage(originalBitmap, 0, 0, outW, outH);

    const blurCanvas = new OffscreenCanvas(outW, outH);
    const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
    blurCtx.filter = 'blur(1.5px)';
    blurCtx.drawImage(origCanvas, 0, 0);

    const op = origCtx.getImageData(0, 0, outW, outH).data;
    const bp = blurCtx.getImageData(0, 0, outW, outH).data;
    const strength = detailsIntensity * 1.5;

    for (let i = 0; i < rp.length; i += 4) {
      rp[i]     = Math.max(0, Math.min(255, rp[i] + (op[i] - bp[i]) * strength));
      rp[i + 1] = Math.max(0, Math.min(255, rp[i + 1] + (op[i + 1] - bp[i + 1]) * strength));
      rp[i + 2] = Math.max(0, Math.min(255, rp[i + 2] + (op[i + 2] - bp[i + 2]) * strength));
    }
    finalCtx.putImageData(resultData, 0, 0);
  }

  // 3. BRIGHTNESS & SATURATION
  if (brightness !== 0 || saturation !== 0) {
    const imageData = finalCtx.getImageData(0, 0, outW, outH);
    const px = imageData.data;
    const bAdj = brightness * 255;
    const satFactor = 1 + saturation;

    for (let i = 0; i < px.length; i += 4) {
      let r = px[i] + bAdj, g = px[i + 1] + bAdj, b = px[i + 2] + bAdj;
      if (saturation !== 0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + satFactor * (r - gray);
        g = gray + satFactor * (g - gray);
        b = gray + satFactor * (b - gray);
      }
      px[i] = Math.max(0, Math.min(255, r));
      px[i + 1] = Math.max(0, Math.min(255, g));
      px[i + 2] = Math.max(0, Math.min(255, b));
    }
    finalCtx.putImageData(imageData, 0, 0);
  }

  // Final Scale Adjustment (if fractional scale requested)
  const originalW = originalBitmap.width;
  const originalH = originalBitmap.height;
  const targetWidth = Math.round(originalW * targetScale);
  const targetHeight = Math.round(originalH * targetScale);

  let resultCanvas = finalCanvas;
  if (finalCanvas.width !== targetWidth || finalCanvas.height !== targetHeight) {
      resultCanvas = new OffscreenCanvas(targetWidth, targetHeight);
      const rCtx = resultCanvas.getContext('2d');
      rCtx.imageSmoothingEnabled = true;
      rCtx.imageSmoothingQuality = 'high';
      rCtx.drawImage(finalCanvas, 0, 0, targetWidth, targetHeight);
  }

  return await createImageBitmap(resultCanvas);
}

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === 'upscale' || type === 'refine') {
    try {
      const progressCallback = (progress, message) => {
        self.postMessage({ type: 'progress', progress, message });
      };

      const params = payload;
      const targetScale = parseFloat(params.scale || cachedScale || 4);

      // Check if we can skip the heavy AI pass
      const isRefine = type === 'refine';
      const isNewImage = params.bitmap !== undefined;
      const isParamChange = params.scale !== undefined && params.scale !== cachedScale;

      let aiOutput = cachedAIResult;
      let originalBitmap = isNewImage ? params.bitmap : cachedOriginalBitmap;

      if (!isRefine && (isNewImage || isParamChange)) {
        // --- HEAVY AI PASS (Tiling) ---
        const sess = await getSession(progressCallback);

        // Clean up old cache
        if (isNewImage && cachedOriginalBitmap) {
            cachedOriginalBitmap.close();
        }

        const originalW = originalBitmap.width;
        const originalH = originalBitmap.height;
        const inputFactor = targetScale / SCALE_FACTOR;

        let processingBitmap = originalBitmap;
        let imgW = originalW;
        let imgH = originalH;

        if (targetScale < SCALE_FACTOR) {
          const turboW = Math.round(originalW * inputFactor);
          const turboH = Math.round(originalH * inputFactor);
          const turboCanvas = new OffscreenCanvas(turboW, turboH);
          const turboCtx = turboCanvas.getContext('2d');
          turboCtx.drawImage(originalBitmap, 0, 0, turboW, turboH);
          processingBitmap = await createImageBitmap(turboCanvas);
          imgW = turboW;
          imgH = turboH;
          progressCallback(0.4, `Turbo ${targetScale}x Mode...`);
        }

        const outW = imgW * SCALE_FACTOR;
        const outH = imgH * SCALE_FACTOR;
        const outputCanvas = new OffscreenCanvas(outW, outH);
        const outputCtx = outputCanvas.getContext('2d');

        const tileInput = new OffscreenCanvas(MAX_INPUT_SIZE, MAX_INPUT_SIZE);
        const tileCtx = tileInput.getContext('2d', { willReadFrequently: true });

        const tiles = [];
        for (let y = 0; y < imgH; y += STRIDE) {
          for (let x = 0; x < imgW; x += STRIDE) {
            tiles.push({ x, y });
          }
        }

        const totalTiles = tiles.length;
        let tilesDone = 0;

        for (const tile of tiles) {
          tilesDone++;
          const sx = tile.x - OVERLAP;
          const sy = tile.y - OVERLAP;

          tileCtx.clearRect(0, 0, MAX_INPUT_SIZE, MAX_INPUT_SIZE);
          tileCtx.drawImage(processingBitmap, sx, sy, MAX_INPUT_SIZE, MAX_INPUT_SIZE, 0, 0, MAX_INPUT_SIZE, MAX_INPUT_SIZE);

          // Edge Clamping
          if (sx < 0) tileCtx.drawImage(processingBitmap, 0, sy, 1, MAX_INPUT_SIZE, 0, 0, -sx, MAX_INPUT_SIZE);
          if (sy < 0) tileCtx.drawImage(processingBitmap, sx, 0, MAX_INPUT_SIZE, 1, 0, 0, MAX_INPUT_SIZE, -sy);
          if (sx + MAX_INPUT_SIZE > imgW) {
            const over = (sx + MAX_INPUT_SIZE) - imgW;
            tileCtx.drawImage(processingBitmap, imgW - 1, sy, 1, MAX_INPUT_SIZE, MAX_INPUT_SIZE - over, 0, over, MAX_INPUT_SIZE);
          }
          if (sy + MAX_INPUT_SIZE > imgH) {
            const over = (sy + MAX_INPUT_SIZE) - imgH;
            tileCtx.drawImage(processingBitmap, sx, imgH - 1, MAX_INPUT_SIZE, 1, 0, MAX_INPUT_SIZE - over, over, 1);
          }

          const imageData = tileCtx.getImageData(0, 0, MAX_INPUT_SIZE, MAX_INPUT_SIZE).data;
          const inputTensorData = new Float32Array(3 * MAX_INPUT_SIZE * MAX_INPUT_SIZE);
          for (let c = 0; c < 3; c++) {
            for (let i = 0; i < MAX_INPUT_SIZE * MAX_INPUT_SIZE; i++) {
              inputTensorData[c * MAX_INPUT_SIZE * MAX_INPUT_SIZE + i] = imageData[i * 4 + c] / 255.0;
            }
          }

          const tensor = new ort.Tensor('float32', inputTensorData, [1, 3, MAX_INPUT_SIZE, MAX_INPUT_SIZE]);
          const results = await sess.run({ image: tensor });
          const outputData = results[sess.outputNames[0]].data;
          const outSize = MAX_INPUT_SIZE * SCALE_FACTOR;
          const outChannelSize = outSize * outSize;

          const rImageData = new ImageData(outSize, outSize);
          const rPixels = rImageData.data;

          for (let i = 0; i < outChannelSize; i++) {
            const pIdx = i * 4;
            rPixels[pIdx]     = Math.max(0, Math.min(255, Math.round(outputData[0 * outChannelSize + i] * 255.0)));
            rPixels[pIdx + 1] = Math.max(0, Math.min(255, Math.round(outputData[1 * outChannelSize + i] * 255.0)));
            rPixels[pIdx + 2] = Math.max(0, Math.min(255, Math.round(outputData[2 * outChannelSize + i] * 255.0)));
            rPixels[pIdx + 3] = 255;
          }

          const rTileCanvas = new OffscreenCanvas(outSize, outSize);
          rTileCanvas.getContext('2d').putImageData(rImageData, 0, 0);

          const outOverlap = OVERLAP * SCALE_FACTOR;
          const outStride = STRIDE * SCALE_FACTOR;

          outputCtx.drawImage(
            rTileCanvas,
            outOverlap, outOverlap, outStride, outStride,
            tile.x * SCALE_FACTOR, tile.y * SCALE_FACTOR, outStride, outStride
          );

          if (tilesDone % 5 === 0 || tilesDone === totalTiles) {
            progressCallback(0.4 + (tilesDone / totalTiles) * 0.5, `Processed ${tilesDone}/${totalTiles} tiles...`);
          }
        }

        // Cache the raw AI result
        cachedAIResult = outputCanvas;
        cachedOriginalBitmap = originalBitmap;
        cachedScale = targetScale;
        aiOutput = outputCanvas;

        if (processingBitmap !== originalBitmap) {
            processingBitmap.close();
        }
      }

      if (!aiOutput || !originalBitmap) {
        throw new Error('No AI result cached. Run upscale first.');
      }

      // --- LIGHT FILTER PASS (Frequency Separation + Grading) ---
      const resultBitmap = await applyFilters(aiOutput, originalBitmap, { ...params, targetScale }, progressCallback);

      self.postMessage({
        type: 'complete',
        result: resultBitmap,
        info: {
          outputSize: `${resultBitmap.width}x${resultBitmap.height}`,
          device: currentDevice,
          mode: isRefine ? 'refine' : 'upscale'
        }
      }, [resultBitmap]);

    } catch (err) {
      console.error('Upscaling error:', err);
      self.postMessage({ type: 'error', error: err.message || 'Upscaling failed' });
    }
  }
};
