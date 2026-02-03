/**
 * Face Blur Worker using YOLO26 Pose via Transformers.js
 * Model: onnx-community/yolo26n-pose-ONNX
 *
 * Uses WebGPU for maximum performance with WASM fallback.
 * Manual Tensor Parsing for surgical keypoint access.
 */

import * as ort from 'onnxruntime-web/webgpu';

// Configure ONNX Runtime
const ORT_VERSION = '1.20.0';
ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

// Optional: HuggingFace Token if repo is private (not needed for onnx-community)
// const HF_TOKEN = '';

// 2026 Optimized Pose Model
const MODEL_VARIANTS = {
  nano: 'onnx-community/yolo26n-pose-ONNX',
  small: 'onnx-community/yolo26s-pose-ONNX',
  medium: 'onnx-community/yolo26m-pose-ONNX',
  large: 'onnx-community/yolo26l-pose-ONNX',
  xlarge: 'onnx-community/yolo26x-pose-ONNX',
};

// Class labels we care about for blurring
// YOLOv10 COCO classes include person, car, bus, truck, motorcycle
const PERSON_LABELS = ['person', 'face', 'human', 'head'];
const TARGET_LABELS = [...PERSON_LABELS];
const CONFIDENCE_THRESHOLD = 0.4;

let session = null;
let currentVariant = 'nano';
let currentDevice = 'wasm';
let isInitializing = false;

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

/**
 * Initialize the YOLO26 Pose model via ORT
 */
async function initDetector(variant = 'nano', onProgress) {
  if (session && currentVariant === variant) return session;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return session;
  }

  isInitializing = true;
  currentVariant = variant;
  const modelId = MODEL_VARIANTS[variant] || MODEL_VARIANTS.nano;

  // Construct direct download URL
  const modelUrl = `https://huggingface.co/${modelId}/resolve/main/onnx/model.onnx`;

  try {
    const modelBuffer = await fetchWithProgress(modelUrl, `YOLO26 ${variant} model`, onProgress, 0.1, 0.6);

    const sessionOptions = {
        executionProviders: ['webgpu'],
        graphOptimizationLevel: 'all',
    };

    onProgress?.(0.7, 'Initializing YOLO26 session...');

    try {
      session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
      currentDevice = 'webgpu';
    } catch (webgpuError) {
      console.warn('WebGPU failed, falling back to WASM:', webgpuError);
      session = await ort.InferenceSession.create(modelBuffer, {
        ...sessionOptions,
        executionProviders: ['wasm'],
      });
      currentDevice = 'wasm';
    }

    onProgress?.(0.8, `Model ready (${currentDevice})`);
    return session;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize detector:', error);
    throw new Error(`Initialization failed: ${errorMsg}`);
  } finally {
    isInitializing = false;
  }
}

/**
 * Detect persons/faces using bit-precise tensor parsing and NMS
 */
async function detectFaces(imageData, width, height) {
  if (!session) throw new Error('Detector not initialized');

  // 1. Preprocessing: Stretching to 640x640 (as per preprocessor_config json)
  const inputSize = 640;
  const canvas = new OffscreenCanvas(inputSize, inputSize);
  const ctx = canvas.getContext('2d');

  const tempCanvas = new OffscreenCanvas(width, height);
  const tempCtx = tempCanvas.getContext('2d');
  const imgData = new ImageData(new Uint8ClampedArray(imageData), width, height);
  tempCtx.putImageData(imgData, 0, 0);

  // Use stretched resize (no aspect ratio preservation)
  ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, inputSize, inputSize);
  const resizedData = ctx.getImageData(0, 0, inputSize, inputSize).data;

  // 2. Image to Tensor (RGB normalized [0,1])
  const inputTensorData = new Float32Array(3 * inputSize * inputSize);
  for (let i = 0; i < inputSize * inputSize; i++) {
    inputTensorData[i] = resizedData[i * 4] / 255.0;
    inputTensorData[inputSize * inputSize + i] = resizedData[i * 4 + 1] / 255.0;
    inputTensorData[2 * inputSize * inputSize + i] = resizedData[i * 4 + 2] / 255.0;
  }

  const tensor = new ort.Tensor('float32', inputTensorData, [1, 3, inputSize, inputSize]);

  // 3. Run Inference
  const inputs = {};
  inputs[session.inputNames[0]] = tensor;
  const outputs = await session.run(inputs);
  const output0 = outputs[session.outputNames[0]];

  // 4. Robust Tensor Parser (Auto-Shape & Auto-Format Detection)
  const data = output0.data;
  const dims = output0.dims;
  const d1 = dims[1];
  const d2 = dims[2];

  const isTransposed = d1 < d2;
  const numPredictions = isTransposed ? d2 : d1;
  const numChannels = isTransposed ? d1 : d2;

  // Auto-detect coordinate domain with exhaustive check
  let isPixelSpace = false;
  for (let j = 0; j < numPredictions; j++) {
      const getVal = (row) => isTransposed ? data[row * numPredictions + j] : data[j * numChannels + row];
      // Only check if there's SOME signal (score > 0.05)
      if (getVal(4) > 0.05) {
          if (getVal(0) > 1.1 || getVal(1) > 1.1 || getVal(2) > 1.1 || getVal(3) > 1.1) {
              isPixelSpace = true;
              break;
          }
      }
  }

  const rawDetections = [];
  const LOCAL_CONF_THRESHOLD = 0.2;

  for (let j = 0; j < numPredictions; ++j) {
    const getVal = (row) => isTransposed ? data[row * numPredictions + j] : data[j * numChannels + row];

    const score = getVal(4);
    if (score < LOCAL_CONF_THRESHOLD) continue;

    let v0 = getVal(0);
    let v1 = getVal(1);
    let v2 = getVal(2);
    let v3 = getVal(3);

    // Normalize immediately if in pixel space
    if (isPixelSpace) { v0 /= 640; v1 /= 640; v2 /= 640; v3 /= 640; }

    // SCIENTIFIC BOX FORMAT INFERENCE
    // In [x1, y1, x2, y2], v2 > v0 and v3 > v1 always.
    // In [cx, cy, w, h], v2 and v3 are sizes.
    // If v2 < v0 or v3 < v1, it's very likely [cx, cy, w, h] or some other format.
    const isCenterFormat = (v2 < v0 * 0.8) || (v3 < v1 * 0.8); // Heuristic for center-based

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

      if (isPixelSpace) { kX /= 640; kY /= 640; }
      keypoints.push([kX, kY, kConf]);
    }

    rawDetections.push({
      score,
      keypoints,
      box: { xmin, ymin, xmax, ymax }
    });
  }

  const finalDetections = nms(rawDetections, 0.75);
  console.log(`[Domain: ${isPixelSpace ? 'Pixel' : 'Norm'}] Parsed ${rawDetections.length} raw -> ${finalDetections.length} after NMS. Shape: [${dims.join(', ')}]`);

  return finalDetections;
}

/**
 * Standard IOU-based NMS
 */
function nms(candidates, iouThreshold) {
  candidates.sort((a, b) => b.score - a.score);
  const kept = [];
  const suppressed = new Set();

  for (let i = 0; i < candidates.length; i++) {
    if (suppressed.has(i)) continue;
    const a = candidates[i];
    kept.push(a);

    for (let j = i + 1; j < candidates.length; j++) {
      if (suppressed.has(j)) continue;
      const b = candidates[j];

      const iou = calculateIOU(a.box, b.box);
      if (iou > iouThreshold) suppressed.add(j);
    }
  }
  return kept;
}

function calculateIOU(box1, box2) {
  const x1 = Math.max(box1.xmin, box2.xmin);
  const y1 = Math.max(box1.ymin, box2.ymin);
  const x2 = Math.min(box1.xmax, box2.xmax);
  const y2 = Math.min(box1.ymax, box2.ymax);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
  const area2 = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);

  return intersection / (area1 + area2 - intersection);
}


async function applyBlur(imageData, width, height, detections, options = {}) {
  const {
    blurAmount = 20,
    radiusScale = 1.0,
    feathering = 0.75,
    shape = 1.0 // 1.0 = circular, > 1.0 = taller elliptical
  } = options;

  const originalCanvas = new OffscreenCanvas(width, height);
  const originalCtx = originalCanvas.getContext('2d');
  const imgData = new ImageData(new Uint8ClampedArray(imageData), width, height);
  originalCtx.putImageData(imgData, 0, 0);

  if (detections.length === 0) {
    return originalCtx.getImageData(0, 0, width, height);
  }

  const resultCanvas = new OffscreenCanvas(width, height);
  const resultCtx = resultCanvas.getContext('2d');
  resultCtx.drawImage(originalCanvas, 0, 0);

  for (const person of detections) {
    const keypoints = person.keypoints;
    if (!keypoints || keypoints.length < 5) continue;

    const nose_kp = keypoints[0];
    const lEye_kp = keypoints[1];
    const rEye_kp = keypoints[2];

    const nose = { x: nose_kp[0], y: nose_kp[1], score: nose_kp[2] };
    const lEye = { x: lEye_kp[0], y: lEye_kp[1], score: lEye_kp[2] };
    const rEye = { x: rEye_kp[0], y: rEye_kp[1], score: rEye_kp[2] };

    // Surgical Geometry with user-adjustable scale
    let radius;
    // Lower eye confidence floor to 0.2 for distant faces
    if (lEye.score > 0.2 && rEye.score > 0.2 && (lEye.x !== 0 || rEye.x !== 0)) {
      const dx_eyes = (lEye.x * width) - (rEye.x * width);
      const dy_eyes = (lEye.y * height) - (rEye.y * height);
      const dist = Math.sqrt(dx_eyes * dx_eyes + dy_eyes * dy_eyes);
      radius = dist * 2.2 * radiusScale;
    } else {
      // Fallback: Use bounding box width (reduced from 0.35 to 0.18 for surgical precision)
      const box = person.box;
      radius = (box.xmax - box.xmin) * width * 0.18 * radiusScale;
    }

    // Min radius check (surgical for distant faces)
    const minRadius = Math.min(width, height) * 0.015;
    if (radius < minRadius) radius = minRadius;

    const maxAllowedRadius = Math.min(width, height) * 0.4;
    if (radius > maxAllowedRadius) radius = maxAllowedRadius;

    const nx = nose.x * width;
    const ny = nose.y * height;

    if (isNaN(nx) || isNaN(ny) || isNaN(radius)) continue;

    // Apply shape scaling to vertical radius
    const radiusY = radius * shape;

    const pw = Math.round(radius * 5); // Taller patches for ellipses
    const ph = Math.round(radiusY * 5);
    const px = Math.round(nx - pw / 2);
    const py = Math.round(ny - ph / 2);

    if (pw < 5 || ph < 5) continue;

    const patchCanvas = new OffscreenCanvas(pw, ph);
    const patchCtx = patchCanvas.getContext('2d');

    try {
      patchCtx.drawImage(originalCanvas, px, py, pw, ph, 0, 0, pw, ph);
    } catch (e) { continue; }

    const localBlurCanvas = new OffscreenCanvas(pw, ph);
    const localBlurCtx = localBlurCanvas.getContext('2d');
    localBlurCtx.filter = `blur(${blurAmount}px)`;
    localBlurCtx.drawImage(patchCanvas, 0, 0);

    const maskCanvas = new OffscreenCanvas(pw, ph);
    const maskCtx = maskCanvas.getContext('2d');

    // Adaptive feathering based on user input
    // Gradient must cover the larger radius side
    const gradRadius = Math.max(radius, radiusY) * 1.2;
    const grad = maskCtx.createRadialGradient(pw/2, ph/2, 0, pw/2, ph/2, gradRadius);
    grad.addColorStop(feathering, 'rgba(0,0,0,1)');
    grad.addColorStop(Math.min(1, feathering + 0.2), 'rgba(0,0,0,0)');

    maskCtx.fillStyle = grad;
    maskCtx.beginPath();
    // Transition to Ellipse for shape support
    maskCtx.ellipse(pw/2, ph/2, radius, radiusY, 0, 0, Math.PI * 2);
    maskCtx.fill();

    const finalPatchCanvas = new OffscreenCanvas(pw, ph);
    const finalPatchCtx = finalPatchCanvas.getContext('2d');
    finalPatchCtx.drawImage(localBlurCanvas, 0, 0);
    finalPatchCtx.globalCompositeOperation = 'destination-in';
    finalPatchCtx.drawImage(maskCanvas, 0, 0);

    resultCtx.drawImage(finalPatchCanvas, px, py);
  }

  return resultCtx.getImageData(0, 0, width, height);
}

/**
 * Cleanup resources
 */
function dispose() {
  if (session) {
    // onnxruntime-web session release is implicit or via delete
    session = null;
  }
  currentDevice = 'wasm';
}

// Message handler
self.onmessage = async (event) => {
  const { type, payload } = event.data;

  const sendProgress = (progress, message) => {
    self.postMessage({ type: 'progress', progress, message });
  };

  try {
    switch (type) {
      case 'init': {
        const variant = payload?.variant || 'nano';
        currentVariant = variant;
        await initDetector(variant, sendProgress);
        self.postMessage({
          type: 'ready',
          device: currentDevice,
          variant: currentVariant,
        });
        break;
      }

      case 'detect': {
        const { imageData, width, height, variant } = payload;

        if (variant && variant !== currentVariant) {
          currentVariant = variant;
          model = null;
          processor = null;
          await initDetector(variant, sendProgress);
        } else {
          await initDetector(currentVariant, sendProgress);
        }

        const detections = await detectFaces(imageData, width, height);

        self.postMessage({
          type: 'detections',
          detections,
          count: detections.length,
          device: currentDevice,
        });
        break;
      }

      case 'blur': {
        const { imageData, width, height, blurAmount = 20, radiusScale = 1.0, feathering = 0.75, shape = 1.0, variant } = payload;

        if (variant && variant !== currentVariant) {
          currentVariant = variant;
          model = null;
          processor = null;
          await initDetector(variant, sendProgress);
        } else {
          await initDetector(currentVariant, sendProgress);
        }

        sendProgress(0.7, 'Detecting...');
        const detections = await detectFaces(imageData, width, height);

        if (detections.length === 0) {
          sendProgress(1, 'No faces/persons detected');
          self.postMessage({
            type: 'complete',
            imageData: new Uint8ClampedArray(imageData),
            width,
            height,
            detections: [],
            count: 0,
            device: currentDevice,
          });
          break;
        }

        sendProgress(0.95, `Blurring ${detections.length} face(s)...`);
        const resultImageData = await applyBlur(imageData, width, height, detections, {
          blurAmount,
          radiusScale,
          feathering,
          shape
        });

        sendProgress(1, `Blurred ${detections.length} face(s)`);

        self.postMessage({
          type: 'complete',
          imageData: resultImageData.data,
          width: resultImageData.width,
          height: resultImageData.height,
          detections,
          count: detections.length,
          device: currentDevice,
        }, [resultImageData.data.buffer]);
        break;
      }

      case 'reblur': {
        const { imageData, width, height, detections, blurAmount = 20, radiusScale = 1.0, feathering = 0.75, shape = 1.0 } = payload;

        const resultImageData = await applyBlur(imageData, width, height, detections, {
          blurAmount,
          radiusScale,
          feathering,
          shape
        });

        self.postMessage({
          type: 'complete',
          imageData: resultImageData.data,
          width: resultImageData.width,
          height: resultImageData.height,
          detections,
          count: detections.length,
          device: currentDevice,
        }, [resultImageData.data.buffer]);
        break;
      }

      case 'dispose': {
        dispose();
        self.postMessage({ type: 'disposed' });
        break;
      }

      default:
        console.warn('Unknown message type:', type);
    }

  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({
      type: 'error',
      error: error.message || 'Processing failed',
    });
  }
};
