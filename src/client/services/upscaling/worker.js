/**
 * Upscaling Worker using ONNX Runtime directly
 * Uses Real-ESRGAN model from HuggingFace (TheGuy444/Real-ESRGAN-ONNX)
 *
 * Supports Tile-based upscaling to handle any image size without loss or clipping.
 */

import * as ort from 'onnxruntime-web/webgpu';
import { createProgressReporter } from '../../core/worker-utils.js';

// Configure ONNX Runtime for stability
ort.env.wasm.numThreads = 1;

// Point to a local directory for WASM files (prevents COEP blocks)
const ORT_VERSION = '1.20.1';
ort.env.wasm.wasmPaths = '/onnx/';

import { UPSCALING_MODELS } from '../../config/models.js';
import {
  DEFAULT_DETAILS_INTENSITY,
  DEFAULT_BRIGHTNESS,
  DEFAULT_SATURATION,
  fetchWithProgress,
  prepareTile,
  packInputTensor,
  unpackOutputTensor,
  applyFilters
} from './helpers.js';

const MODEL_ONNX_URL = UPSCALING_MODELS.onnx.url;
const MODEL_DATA_URL = UPSCALING_MODELS.data.url;


const MAX_INPUT_SIZE = 128; // Model expects exactly 128x128
const SCALE_FACTOR = 4;
const OVERLAP = 16;         // Standard overlap for Real-ESRGAN
const STRIDE = MAX_INPUT_SIZE - (OVERLAP * 2); // 96px

let session = null;
let currentDevice = null;

async function getSession(onProgress) {
  if (session) return session;

  const report = createProgressReporter(onProgress);

  try {
    const useWebGPU = !!navigator.gpu;
    const executionProviders = useWebGPU ? ['webgpu'] : ['wasm'];
    const deviceLabel = useWebGPU ? 'WEBGPU' : 'WASM';

    const modelBuffer = await fetchWithProgress(MODEL_ONNX_URL, 'model structure', report, 0.05, 0.1);
    const dataBuffer = await fetchWithProgress(MODEL_DATA_URL, 'model weights', report, 0.1, 0.3);

    const sessionOptions = {
      executionProviders,
      graphOptimizationLevel: 'all',
      externalData: [
        {
          path: 'model.data',
          data: new Uint8Array(dataBuffer),
        }
      ]
    };

    report(0.3, 0.3, `Initializing Real-ESRGAN (${deviceLabel})...`)(0);

    session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
    currentDevice = useWebGPU ? 'webgpu' : 'wasm';
    report(0.4, 0.4, 'Model ready')(0);
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



self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === 'upscale' || type === 'refine') {
    try {
      const onProgress = (prog, msg) => self.postMessage({ type: 'progress', progress: prog, message: msg });
      const report = createProgressReporter(onProgress);

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
        const sess = await getSession(onProgress);

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
          report(0.4, 0.4, `Turbo ${targetScale}x Mode...`)(0);
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

          prepareTile(tile, processingBitmap, imgW, imgH, OVERLAP, MAX_INPUT_SIZE, tileCtx);

          const imageData = tileCtx.getImageData(0, 0, MAX_INPUT_SIZE, MAX_INPUT_SIZE).data;
          const inputTensorData = packInputTensor(imageData, MAX_INPUT_SIZE);

          const tensor = new ort.Tensor('float32', inputTensorData, [1, 3, MAX_INPUT_SIZE, MAX_INPUT_SIZE]);
          const results = await sess.run({ image: tensor });
          const outputData = results[sess.outputNames[0]].data;
          const outSize = MAX_INPUT_SIZE * SCALE_FACTOR;

          const rImageData = unpackOutputTensor(outputData, outSize);

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
            report(0.4, 0.9, `Processed ${tilesDone}/${totalTiles} tiles...`)((tilesDone / totalTiles) * 100);
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
      const resultBitmap = await applyFilters(aiOutput, originalBitmap, { ...params, targetScale }, onProgress);

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

  // Explicit cleanup — releases cached GPU memory (ImageBitmap) on demand
  if (type === 'clear') {
    if (cachedOriginalBitmap) {
      cachedOriginalBitmap.close();
      cachedOriginalBitmap = null;
    }
    cachedAIResult = null;
    cachedScale = null;
    self.postMessage({ type: 'cleared' });
  }

  // Model eviction — called by WorkerRegistry when switching to another service.
  // The session is released so WebGPU/WASM memory is freed.
  // Model weights stay in the browser HTTP cache for fast re-loading.
  if (type === 'dispose') {
    if (cachedOriginalBitmap) { cachedOriginalBitmap.close(); cachedOriginalBitmap = null; }
    cachedAIResult = null;
    cachedScale = null;
    if (session) {
      try { session.release?.(); } catch (_) {}
      session = null;
      currentDevice = null;
    }
  }
};
