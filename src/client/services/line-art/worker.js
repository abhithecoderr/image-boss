/**
 * Line Art Worker using Informative Drawings AI Model
 * Model: x-Liola-x/informative-drawings-onnx
 */

import * as ort from "onnxruntime-web/webgpu";
import { getGPUConfig, createProgressReporter, fetchWithProgress, imageToTensor, configureOrt, createOrtSessionManager } from '../../utils/worker-utils.js';

// Configure ONNX Runtime
configureOrt(ort);

import { LINE_ART_MODELS } from '../../config/models.js';

const MODEL_URLS = LINE_ART_MODELS;

const MODEL_SIZE = 768;

// ORT session lifecycle is managed centrally — the manager replaces the
// isInitializing busy-wait loop and session/variant/device module state.
let session = null;
const ortManager = createOrtSessionManager(ort, {
  async resolveBuffer(variant, report) {
    const modelConfig = MODEL_URLS[variant] || MODEL_URLS.anime;
    return fetchWithProgress(modelConfig.url, `Line Art AI (${variant})`, report, 0.1, 0.8);
  },
});

async function initSession(variant = "anime", onProgress) {
  session = await ortManager.get(variant, onProgress);
  return session;
}

async function runInference(bitmap, options, onProgress) {
  const { aiVariant = 'anime', details = 75, outputStyle = 'natural' } = options;
  const s = await initSession(aiVariant, onProgress);

  const width = bitmap.width;
  const height = bitmap.height;

  // 1. Preprocessing & Image to Tensor
  const tensorData = await imageToTensor(bitmap, MODEL_SIZE, {
    mean: [0, 0, 0],
    std: [1, 1, 1],
    layout: 'NCHW',
    scale: 1.0 / 255.0
  });

  const tensor = new ort.Tensor("float32", tensorData, [1, 3, MODEL_SIZE, MODEL_SIZE]);

  // 2. Inference
  const inputs = { [session.inputNames[0]]: tensor };
  const outputs = await session.run(inputs);
  const output = outputs[session.outputNames[0]];

  // 3. Postprocessing
  const data = output.data;
  const outData = new Uint8ClampedArray(MODEL_SIZE * MODEL_SIZE * 4);

  // Details slider mapping: 0-100 -> 0-255 threshold
  // Higher details should mean more lines, so lower threshold?
  // Let's check original Sobel: threshold = Math.max(1, 200 - (details * 2));
  // In AI mode, if outputStyle is 'clean', we threshold the result.
  const thresholdValue = Math.max(1, 255 - (details * 2.5));

  for (let i = 0; i < MODEL_SIZE * MODEL_SIZE; i++) {
    let val = Math.round(data[i] * 255);

    if (outputStyle === 'clean') {
        // Model usually outputs dark for lines? Let's assume high value = clean background
        // Wait, Sobel: magnitude > threshold ? black : white
        // Informative drawings: output is usually lines.
        // Actually Informative Drawings output is closer to grayscale sketch.
        // If val > thresholdValue -> background (255), else line (0)
        val = val > (255 - thresholdValue) ? 255 : 0;
    }

    outData[i * 4] = val;
    outData[i * 4 + 1] = val;
    outData[i * 4 + 2] = val;
    outData[i * 4 + 3] = 255;
  }

  const resultCanvas = new OffscreenCanvas(MODEL_SIZE, MODEL_SIZE);
  resultCanvas.getContext('2d').putImageData(new ImageData(outData, MODEL_SIZE, MODEL_SIZE), 0, 0);

  // Resize back to original if needed or just send the 768x768 and scale in UI
  // The system seems to favor sending ImageBitmap back.
  const resultBitmap = await createImageBitmap(resultCanvas);

  return {
    resultBitmap,
    width,
    height
  };
}

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    if (type === "process") {
      const { bitmap, options } = payload;
      const result = await runInference(bitmap, options, (progress, message) => {
        self.postMessage({ type: "progress", progress, message });
      });

      self.postMessage({
        type: "complete",
        result
      }, [result.resultBitmap]);

      bitmap.close();
    } else if (type === "dispose") {
      ortManager.release();
      session = null;
      self.postMessage({ type: "disposed" });
    }
  } catch (error) {
    self.postMessage({ type: "error", error: error.message });
  }
};
