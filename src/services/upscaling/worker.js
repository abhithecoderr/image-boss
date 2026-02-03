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

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === 'upscale') {
    try {
      const { bitmap } = payload;
      const progressCallback = (progress, message) => {
        self.postMessage({ type: 'progress', progress, message });
      };

      const sess = await getSession(progressCallback);

      const { scale = 4, detailsIntensity = DEFAULT_DETAILS_INTENSITY, brightness = DEFAULT_BRIGHTNESS, saturation = DEFAULT_SATURATION } = payload;
      const originalW = bitmap.width;
      const originalH = bitmap.height;
      let imgW = originalW;
      let imgH = originalH;

      // Determine target output scale and input processing factor
      const targetScale = parseFloat(scale);
      const isSuperTurbo = (targetScale === 1.5);
      const inputFactor = targetScale / SCALE_FACTOR;

      // TURBO OPTIMIZATION:
      // We leverage the 4x model to process 2x or 3x faster by downscaling the input first.
      let processingBitmap = bitmap;
      if (targetScale < SCALE_FACTOR) {
        const factor = inputFactor;
        const turboW = Math.round(originalW * factor);
        const turboH = Math.round(originalH * factor);
        const turboCanvas = new OffscreenCanvas(turboW, turboH);
        const turboCtx = turboCanvas.getContext('2d', { willReadFrequently: true });
        turboCtx.imageSmoothingEnabled = true;
        turboCtx.imageSmoothingQuality = 'high';
        turboCtx.drawImage(bitmap, 0, 0, turboW, turboH);
        processingBitmap = await createImageBitmap(turboCanvas);
        imgW = turboW;
        imgH = turboH;
        progressCallback(0.4, `${isSuperTurbo ? 'Super ' : '' }Turbo ${targetScale}x Mode: Processing at reduced resolution (${turboW}x${turboH})...`);
      } else {
        progressCallback(0.4, `Upscaling with Overlap (${imgW}x${imgH})...`);
      }

      const outW = imgW * SCALE_FACTOR;
      const outH = imgH * SCALE_FACTOR;

      const outputCanvas = new OffscreenCanvas(outW, outH);
      const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });

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

      // Sequential processing for stability (The model is static [1,3,128,128])
      for (const tile of tiles) {
        tilesDone++;

        // Prepare tile input
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

        // Tensor Prep
        const imageData = tileCtx.getImageData(0, 0, MAX_INPUT_SIZE, MAX_INPUT_SIZE).data;
        const inputTensorData = new Float32Array(3 * MAX_INPUT_SIZE * MAX_INPUT_SIZE);
        for (let c = 0; c < 3; c++) {
          for (let i = 0; i < MAX_INPUT_SIZE * MAX_INPUT_SIZE; i++) {
            inputTensorData[c * MAX_INPUT_SIZE * MAX_INPUT_SIZE + i] = imageData[i * 4 + c] / 255.0;
          }
        }

        // Inference
        const tensor = new ort.Tensor('float32', inputTensorData, [1, 3, MAX_INPUT_SIZE, MAX_INPUT_SIZE]);
        const results = await sess.run({ image: tensor });
        const outputData = results[sess.outputNames[0]].data;
        const outSize = MAX_INPUT_SIZE * SCALE_FACTOR;
        const outChannelSize = outSize * outSize;

        // Stitch Results back
        const resultTileCanvas = new OffscreenCanvas(outSize, outSize);
        const rTileCtx = resultTileCanvas.getContext('2d', { willReadFrequently: true });
        const rImageData = rTileCtx.createImageData(outSize, outSize);
        const rPixels = rImageData.data;

        for (let i = 0; i < outChannelSize; i++) {
          const pIdx = i * 4;
          rPixels[pIdx]     = Math.max(0, Math.min(255, Math.round(outputData[0 * outChannelSize + i] * 255.0)));
          rPixels[pIdx + 1] = Math.max(0, Math.min(255, Math.round(outputData[1 * outChannelSize + i] * 255.0)));
          rPixels[pIdx + 2] = Math.max(0, Math.min(255, Math.round(outputData[2 * outChannelSize + i] * 255.0)));
          rPixels[pIdx + 3] = 255;
        }
        rTileCtx.putImageData(rImageData, 0, 0);

        const outOverlap = OVERLAP * SCALE_FACTOR;
        const outStride = STRIDE * SCALE_FACTOR;

        outputCtx.drawImage(
          resultTileCanvas,
          outOverlap, outOverlap, outStride, outStride,
          tile.x * SCALE_FACTOR, tile.y * SCALE_FACTOR, outStride, outStride
        );

        if (tilesDone % 5 === 0 || tilesDone === totalTiles) {
          progressCallback(
            0.4 + (tilesDone / totalTiles) * 0.5,
            `Processed ${tilesDone}/${totalTiles} tiles...`
          );
        }
      }

      progressCallback(0.95, 'Stitching result...');

      progressCallback(0.95, 'Running Frequency Separation (Texture Restoration)...');

      // FREQUENCY SEPARATION: Surgical Detail Injection
      const finalCanvas = new OffscreenCanvas(outW, outH);
      const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });

      // 1. BASE: The AI result provides the sharp "geometry" and structure
      finalCtx.drawImage(outputCanvas, 0, 0);

      // 2. DETAILS ENHANCEMENT via Unsharp Mask (no darkening)
      // This adds edge/texture information directly without changing overall brightness
      if (detailsIntensity > 0) {
        progressCallback(0.96, 'Enhancing details...');

        // Get the AI result pixels
        const resultData = finalCtx.getImageData(0, 0, outW, outH);
        const rp = resultData.data;

        // Create upscaled original for edge extraction
        const origCanvas = new OffscreenCanvas(outW, outH);
        const origCtx = origCanvas.getContext('2d', { willReadFrequently: true });
        origCtx.imageSmoothingEnabled = true;
        origCtx.imageSmoothingQuality = 'high';
        origCtx.drawImage(bitmap, 0, 0, outW, outH);

        // Create blurred version
        const blurCanvas = new OffscreenCanvas(outW, outH);
        const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
        blurCtx.filter = 'blur(1.5px)';
        blurCtx.drawImage(origCanvas, 0, 0);
        blurCtx.filter = 'none';

        const origData = origCtx.getImageData(0, 0, outW, outH);
        const blurData = blurCtx.getImageData(0, 0, outW, outH);
        const op = origData.data, bp = blurData.data;

        // Unsharp mask: result + (original - blur) * intensity
        // This adds detail without changing overall luminance
        const strength = detailsIntensity * 1.5; // Scale for visible effect

        for (let i = 0; i < rp.length; i += 4) {
          // Edge = original - blur (can be negative or positive)
          const edgeR = op[i] - bp[i];
          const edgeG = op[i + 1] - bp[i + 1];
          const edgeB = op[i + 2] - bp[i + 2];

          // Add edges to AI result
          rp[i]     = Math.max(0, Math.min(255, rp[i] + edgeR * strength));
          rp[i + 1] = Math.max(0, Math.min(255, rp[i + 1] + edgeG * strength));
          rp[i + 2] = Math.max(0, Math.min(255, rp[i + 2] + edgeB * strength));
        }

        finalCtx.putImageData(resultData, 0, 0);
      }

      // 3. BRIGHTNESS & SATURATION adjustments
      if (brightness !== 0 || saturation !== 0) {
        const imageData = finalCtx.getImageData(0, 0, outW, outH);
        const px = imageData.data;

        for (let i = 0; i < px.length; i += 4) {
          let r = px[i], g = px[i + 1], b = px[i + 2];

          // Brightness adjustment
          if (brightness !== 0) {
            const bAdj = brightness * 255;
            r += bAdj; g += bAdj; b += bAdj;
          }

          // Saturation adjustment
          if (saturation !== 0) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const satFactor = 1 + saturation;
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

      // Use the composite for final result
      let resultCanvas = finalCanvas;

      // Ensure the final result matches the requested scale relative to the TRUE original
      const targetWidth = Math.round(originalW * targetScale);
      const targetHeight = Math.round(originalH * targetScale);

      if (resultCanvas.width !== targetWidth || resultCanvas.height !== targetHeight) {
          resultCanvas = new OffscreenCanvas(targetWidth, targetHeight);
          const rCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
          rCtx.imageSmoothingEnabled = true;
          rCtx.imageSmoothingQuality = 'high';
          rCtx.drawImage(finalCanvas, 0, 0, targetWidth, targetHeight);
          progressCallback(0.98, `Finalizing ${targetScale}x output...`);
      }

      const resultBitmap = await createImageBitmap(resultCanvas);

      self.postMessage({
        type: 'complete',
        result: resultBitmap,
        info: {
          originalSize: `${originalW}x${originalH}`,
          outputSize: `${resultCanvas.width}x${resultCanvas.height}`,
          requestedScale: `${targetScale}x`,
          tilesProcessed: totalTiles,
          device: currentDevice,
          mode: isSuperTurbo ? 'super-turbo' : (targetScale < SCALE_FACTOR ? 'turbo' : 'standard')
        }
      }, [resultBitmap]);

      bitmap.close();

    } catch (err) {
      console.error('Upscaling error:', err);
      self.postMessage({ type: 'error', error: err.message || 'Upscaling failed' });
    }
  }
};
