/**
 * Face Blur Worker using YOLO26 Pose via Transformers.js
 * Model: onnx-community/yolo26n-pose-ONNX
 *
 * Uses WebGPU for maximum performance with WASM fallback.
 * Manual Tensor Parsing for surgical keypoint access.
 */

import * as ort from "onnxruntime-web/webgpu";
import {
  getGPUConfig,
  createProgressReporter,
  fetchWithProgress,
  imageToTensor,
  configureOrt,
  createOrtSessionManager,
  canvasCache,
} from "../../utils/worker-utils.js";
import { BLUR_MODELS } from '../../config/models.js';
import { nms, applyBlur } from './helpers.js';

// Configure ONNX Runtime
configureOrt(ort);

// Optional: HuggingFace Token if repo is private (not needed for onnx-community)
// const HF_TOKEN = '';


// 2026 Optimized Pose Model
const MODEL_VARIANTS = BLUR_MODELS;


// Class labels we care about for blurring
// YOLOv10 COCO classes include person, car, bus, truck, motorcycle
const PERSON_LABELS = ["person", "face", "human", "head"];
const TARGET_LABELS = [...PERSON_LABELS];
const CONFIDENCE_THRESHOLD = 0.4;

// ORT session lifecycle is managed centrally — the manager replaces the
// isInitializing busy-wait loop and session/variant/device module state.
let session = null;
const ortManager = createOrtSessionManager(ort, {
  async resolveBuffer(variant, report) {
    const modelConfig = MODEL_VARIANTS[variant] || MODEL_VARIANTS.nano;
    const modelUrl = modelConfig.model_url || `https://huggingface.co/${modelConfig.model_id}/resolve/main/onnx/model.onnx`;
    return fetchWithProgress(modelUrl, `YOLO26 ${variant} model`, report, 0.1, 0.6);
  },
});

/**
 * Initialize the YOLO26 Pose model via ORT.
 */
async function initDetector(variant = "nano", onProgress) {
  session = await ortManager.get(variant, onProgress);
  return session;
}

/**
 * Cleanup resources — releases session
 */
function dispose() {
  ortManager.release();
  session = null;
  canvasCache.clear();
}

/**
 * Detect persons/faces using bit-precise tensor parsing and NMS
 */
async function detectFaces(bitmap, width, height) {
  if (!session) throw new Error("Detector not initialized");

  // 1. Preprocessing & Image to Tensor
  const inputSize = 640;
  const tensorData = await imageToTensor(bitmap, inputSize, {
    mean: [0, 0, 0],
    std: [1, 1, 1],
    layout: 'NCHW',
    scale: 1.0 / 255.0
  });

  let tensor = null;
  let outputs = null;
  let data;
  let dims;
  try {
    tensor = new ort.Tensor("float32", tensorData, [
      1,
      3,
      inputSize,
      inputSize,
    ]);

    // 3. Inference via ORT
    const inputs = {};
    inputs[session.inputNames[0]] = tensor;
    outputs = await session.run(inputs);
    const output0 = outputs[session.outputNames[0]];
    data = output0.data;
    dims = output0.dims;
  } finally {
    tensor?.dispose?.();
    if (outputs) {
      for (const key in outputs) {
        outputs[key]?.dispose?.();
      }
    }
  }

  const d1 = dims[1];
  const d2 = dims[2];

  const isTransposed = d1 < d2;
  const numPredictions = isTransposed ? d2 : d1;
  const numChannels = isTransposed ? d1 : d2;

  // Auto-detect coordinate domain with exhaustive check
  let isPixelSpace = false;
  for (let j = 0; j < numPredictions; j++) {
    const getVal = (row) =>
      isTransposed
        ? data[row * numPredictions + j]
        : data[j * numChannels + row];
    // Only check if there's SOME signal (score > 0.05)
    if (getVal(4) > 0.05) {
      if (
        getVal(0) > 1.1 ||
        getVal(1) > 1.1 ||
        getVal(2) > 1.1 ||
        getVal(3) > 1.1
      ) {
        isPixelSpace = true;
        break;
      }
    }
  }

  const rawDetections = [];
  const LOCAL_CONF_THRESHOLD = 0.2;

  for (let j = 0; j < numPredictions; ++j) {
    const getVal = (row) =>
      isTransposed
        ? data[row * numPredictions + j]
        : data[j * numChannels + row];

    const score = getVal(4);
    if (score < LOCAL_CONF_THRESHOLD) continue;

    let v0 = getVal(0);
    let v1 = getVal(1);
    let v2 = getVal(2);
    let v3 = getVal(3);

    // Normalize immediately if in pixel space
    if (isPixelSpace) {
      v0 /= 640;
      v1 /= 640;
      v2 /= 640;
      v3 /= 640;
    }

    // SCIENTIFIC BOX FORMAT INFERENCE
    // In [x1, y1, x2, y2], v2 > v0 and v3 > v1 always.
    // In [cx, cy, w, h], v2 and v3 are sizes.
    // If v2 < v0 or v3 < v1, it's very likely [cx, cy, w, h] or some other format.
    const isCenterFormat = v2 < v0 * 0.8 || v3 < v1 * 0.8; // Heuristic for center-based

    let xmin, ymin, xmax, ymax;
    if (isCenterFormat) {
      xmin = v0 - v2 / 2;
      ymin = v1 - v3 / 2;
      xmax = v0 + v2 / 2;
      ymax = v1 + v3 / 2;
    } else {
      xmin = v0;
      ymin = v1;
      xmax = v2;
      ymax = v3;
    }

    const kptStart = numChannels === 57 ? 6 : 5;
    const keypoints = [];
    for (let k = 0; k < 17; ++k) {
      let kX = getVal(kptStart + k * 3);
      let kY = getVal(kptStart + k * 3 + 1);
      const kConf = getVal(kptStart + k * 3 + 2);

      if (isPixelSpace) {
        kX /= 640;
        kY /= 640;
      }
      keypoints.push([kX, kY, kConf]);
    }

    rawDetections.push({
      score,
      keypoints,
      box: { xmin, ymin, xmax, ymax },
    });
  }

  const finalDetections = nms(rawDetections, 0.75);

  return finalDetections;
}

// Message handler
self.onmessage = async (event) => {
  const { type, payload } = event.data;

  const sendProgress = (progress, message) => {
    self.postMessage({ type: "progress", progress, message });
  };

  try {
    switch (type) {
      case "init": {
        const variant = payload?.variant || "nano";
        await initDetector(variant, sendProgress);
        self.postMessage({
          type: "complete",
          result: {
            device: ortManager.getDevice(),
            variant,
          }
        });
        break;
      }

      case "detect": {
        const { bitmap, width, height, variant } = payload;
        await initDetector(variant || "nano", sendProgress);

        const detections = await detectFaces(bitmap, width, height);
        bitmap.close();

        self.postMessage({
          type: "complete",
          result: {
            detections,
            count: detections.length,
            device: ortManager.getDevice(),
          }
        });
        break;
      }

      case "blur": {
        const {
          bitmap,
          width,
          height,
          blurAmount = 20,
          radiusScale = 1.0,
          feathering = 0.75,
          shape = 1.0,
          variant,
        } = payload;

        await initDetector(variant || "nano", sendProgress);

        sendProgress(0.7, "Detecting...");
        const detections = await detectFaces(bitmap, width, height);

        if (detections.length === 0) {
          sendProgress(1, "No faces/persons detected");
          // Create a copy of the bitmap to send back as result
          const resultBitmap = await createImageBitmap(bitmap);
          bitmap.close();
          self.postMessage(
            {
              type: "complete",
              result: {
                resultBitmap,
                width,
                height,
                detections: [],
                count: 0,
                device: ortManager.getDevice(),
              }
            },
            [resultBitmap],
          );
          break;
        }

        sendProgress(0.95, `Blurring ${detections.length} face(s)...`);
        const resultBitmap = await applyBlur(
          bitmap,
          width,
          height,
          detections,
          {
            blurAmount,
            radiusScale,
            feathering,
            shape,
          },
        );
        bitmap.close();

        sendProgress(1, `Blurred ${detections.length} face(s)`);

        self.postMessage(
          {
            type: "complete",
            result: {
              resultBitmap,
              detections,
              count: detections.length,
              device: ortManager.getDevice(),
            }
          },
          [resultBitmap],
        );
        break;
      }

      case "reblur": {
        const {
          bitmap,
          width,
          height,
          detections,
          blurAmount = 20,
          radiusScale = 1.0,
          feathering = 0.75,
          shape = 1.0,
        } = payload;

        const resultBitmap = await applyBlur(
          bitmap,
          width,
          height,
          detections,
          {
            blurAmount,
            radiusScale,
            feathering,
            shape,
          },
        );
        bitmap.close();

        self.postMessage(
          {
            type: "complete",
            result: {
              resultBitmap,
              detections,
              count: detections.length,
              device: ortManager.getDevice(),
            }
          },
          [resultBitmap],
        );
        break;
      }

      case "dispose": {
        dispose();
        self.postMessage({ type: "complete", result: "disposed" });
        break;
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error.message || "Processing failed",
    });
  }
};
