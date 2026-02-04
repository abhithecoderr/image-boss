import {
  pipeline,
  env,
  AutoModel,
  AutoModelForImageSegmentation,
  AutoProcessor,
  RawImage,
  Tensor,
} from "@huggingface/transformers";

// Environment config for fastest loading
env.allowLocalModels = false;
env.useBrowserCache = true; // Cache model in IndexedDB

// Cache for loaded models
const segmenters = {};

// Hardware support state
let gpuConfig = null;
let gpuFailed = false;

// Raw mask data (Float32Array) for instant refinement
let lastMask = null;
let lastImage = null; // Store for refinement (RawImage)
let lastMaskWidth = 0;
let lastMaskHeight = 0;
let lastMaskIsUint8 = false;
let lastMaskIsProbability = false;
let featherTemp = null;
let guidedPool = { size: 0, buffers: {} };
let upsampleTemp = null;

/**
 * Detect WebGPU and fp16 support
 */
async function getGPUConfig() {
  if (gpuConfig) return gpuConfig;

  if (!navigator.gpu) {
    gpuConfig = { supported: false, fp16: false };
    return gpuConfig;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      gpuConfig = { supported: false, fp16: false };
      return gpuConfig;
    }

    // Check for fp16 (shader-f16) extension
    const hasFP16 = adapter.features.has("shader-f16");
    gpuConfig = { supported: true, fp16: hasFP16 };
  } catch (err) {
    console.warn("WebGPU check failed:", err);
    gpuConfig = { supported: false, fp16: false };
  }

  return gpuConfig;
}

/**
 * Safely dispose of all tensors in an object or array
 */
function disposeTensors(obj) {
  if (!obj) return;
  if (obj && typeof obj.dispose === "function") {
    obj.dispose();
  } else if (Array.isArray(obj)) {
    obj.forEach(disposeTensors);
  } else if (typeof obj === "object") {
    Object.values(obj).forEach((item) => {
      if (item && typeof item.dispose === "function") {
        item.dispose();
      }
    });
  }
}

/**
 * Convert ImageBitmap to OffscreenCanvas for RawImage compatibility
 */
function bitmapToCanvas(bitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

/**
 * Apply Box Blur to alpha channel for feathering
 * Efficient 1D passes to avoid heavy computation
 */
function applyFeathering(data, width, height, radius) {
  if (radius <= 0) return data;

  if (!featherTemp || featherTemp.length !== data.length) {
    featherTemp = new Uint8Array(data.length);
  }
  const kernelSize = radius * 2 + 1;

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = -radius; x < width + radius; x++) {
      const val = data[y * width + Math.min(Math.max(x, 0), width - 1)];
      sum += val;
      if (x >= radius) {
        featherTemp[y * width + (x - radius)] = sum / kernelSize;
        sum -=
          data[
            y * width + Math.min(Math.max(x - (kernelSize - 1), 0), width - 1)
          ];
      }
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y < height + radius; y++) {
      const val =
        featherTemp[Math.min(Math.max(y, 0), height - 1) * width + x];
      sum += val;
      if (y >= radius) {
        data[(y - radius) * width + x] = sum / kernelSize;
        sum -=
          featherTemp[
            Math.min(Math.max(y - (kernelSize - 1), 0), height - 1) * width + x
          ];
      }
    }
  }
  return data;
}

/**
 * Fast Guided Filter implementation for edge-aware mask refinement
 * @param {Float32Array} p - Input mask buffer [0-1]
 * @param {Uint8Array} I - Guidance image buffer (Grayscale)
 * @param {number} width - Buffer width
 * @param {number} height - Buffer height
 * @param {number} r - Filter radius
 * @param {number} eps - Regularization parameter (e.g. 0.01^2)
 * @returns {Float32Array} - Refined mask
 */
function guidedFilter(p, I, width, height, r, eps) {
  const n = width * height;
  const pool = getGuidedPool(n);

  // Convert I to Float32 [0-1]
  const If = pool.If;
  for (let i = 0; i < n; i++) If[i] = I[i] / 255;

  const mean_I = boxBlur(If, width, height, r, pool.tmp, pool.mean_I);
  const mean_p = boxBlur(p, width, height, r, pool.tmp, pool.mean_p);
  multiplyInto(pool.tmpMul, If, p);
  const mean_Ip = boxBlur(pool.tmpMul, width, height, r, pool.tmp, pool.mean_Ip);

  // cov_Ip = mean_Ip - mean_I * mean_p
  multiplyInto(pool.tmpMul, mean_I, mean_p);
  subtractInto(pool.cov_Ip, mean_Ip, pool.tmpMul);

  multiplyInto(pool.tmpMul, If, If);
  const mean_II = boxBlur(pool.tmpMul, width, height, r, pool.tmp, pool.mean_II);
  // var_I = mean_II - mean_I * mean_I
  multiplyInto(pool.tmpMul, mean_I, mean_I);
  subtractInto(pool.var_I, mean_II, pool.tmpMul);

  // a = cov_Ip / (var_I + eps)
  addScalarInto(pool.tmpMul, pool.var_I, eps);
  divideInto(pool.a, pool.cov_Ip, pool.tmpMul);
  // b = mean_p - a * mean_I
  multiplyInto(pool.tmpMul, pool.a, mean_I);
  subtractInto(pool.b, mean_p, pool.tmpMul);

  const mean_a = boxBlur(pool.a, width, height, r, pool.tmp, pool.mean_a);
  const mean_b = boxBlur(pool.b, width, height, r, pool.tmp, pool.mean_b);

  multiplyInto(pool.tmpMul, mean_a, If);
  addInto(pool.out, pool.tmpMul, mean_b);
  return pool.out;
}

// Optimized Box Blur (1D passes) for Guided Filter
function boxBlur(data, width, height, radius, temp, out) {
  const result = out || new Float32Array(data.length);
  const kernelSize = radius * 2 + 1;

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = -radius; x < width + radius; x++) {
      const val = data[y * width + Math.min(Math.max(x, 0), width - 1)];
      sum += val;
      if (x >= radius) {
        result[y * width + (x - radius)] = sum / kernelSize;
        sum -= data[y * width + Math.min(Math.max(x - (kernelSize - 1), 0), width - 1)];
      }
    }
  }

  const intermediate = temp || new Float32Array(result);
  if (temp) temp.set(result);
  // Vertical pass
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y < height + radius; y++) {
      const val = intermediate[Math.min(Math.max(y, 0), height - 1) * width + x];
      sum += val;
      if (y >= radius) {
        result[(y - radius) * width + x] = sum / kernelSize;
        sum -= intermediate[Math.min(Math.max(y - (kernelSize - 1), 0), height - 1) * width + x];
      }
    }
  }
  return result;
}

// Math helpers for pixel-wise Float32Array operations
function multiplyInto(out, a, b) {
  const n = a.length;
  for (let i = 0; i < n; i++) out[i] = a[i] * b[i];
}
function subtractInto(out, a, b) {
  const n = a.length;
  for (let i = 0; i < n; i++) out[i] = a[i] - b[i];
}
function addInto(out, a, b) {
  const n = a.length;
  for (let i = 0; i < n; i++) out[i] = a[i] + b[i];
}
function addScalarInto(out, a, s) {
  const n = a.length;
  for (let i = 0; i < n; i++) out[i] = a[i] + s;
}
function divideInto(out, a, b) {
  const n = a.length;
  for (let i = 0; i < n; i++) out[i] = a[i] / b[i];
}

function getGuidedPool(size) {
  if (guidedPool.size !== size) {
    guidedPool = {
      size,
      buffers: {
        If: new Float32Array(size),
        mean_I: new Float32Array(size),
        mean_p: new Float32Array(size),
        mean_Ip: new Float32Array(size),
        mean_II: new Float32Array(size),
        var_I: new Float32Array(size),
        cov_Ip: new Float32Array(size),
        a: new Float32Array(size),
        b: new Float32Array(size),
        mean_a: new Float32Array(size),
        mean_b: new Float32Array(size),
        tmp: new Float32Array(size),
        tmpMul: new Float32Array(size),
        out: new Float32Array(size),
      },
    };
  }
  return guidedPool.buffers;
}

function resizeMaskBilinear(src, srcW, srcH, dstW, dstH, dst) {
  const out = dst || new Float32Array(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy = y * yRatio;
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const wy = sy - y0;
    const row0 = y0 * srcW;
    const row1 = y1 * srcW;
    for (let x = 0; x < dstW; x++) {
      const sx = x * xRatio;
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const wx = sx - x0;
      const v00 = src[row0 + x0];
      const v10 = src[row0 + x1];
      const v01 = src[row1 + x0];
      const v11 = src[row1 + x1];
      const v0 = v00 + (v10 - v00) * wx;
      const v1 = v01 + (v11 - v01) * wx;
      out[y * dstW + x] = v0 + (v1 - v0) * wy;
    }
  }
  return out;
}

/**
 * Convert RGB buffer to Grayscale Uint8Array
 */
function toGrayscale(data, width, height) {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/**
 * Sharpen mask edges using a sigmoid-like curve
 * This pushes intermediate values towards 0 or 1, creating crisper edges
 * @param {number} value - Input value [0-1]
 * @param {number} strength - Sharpening strength (1=none, higher=sharper)
 * @returns {number} - Sharpened value [0-1]
 */
function sharpenEdgeValue(value, strength = 2) {
  // Only sharpen values in the transition zone (0.1 to 0.9)
  // This preserves clean edges while tightening fuzzy ones
  if (value <= 0.05) return 0;
  if (value >= 0.95) return 1;

  // Sigmoid-like curve centered at 0.5
  const centered = value - 0.5;
  const sharpened = 0.5 + 0.5 * Math.tanh(centered * strength * 2);
  return Math.max(0, Math.min(1, sharpened));
}

/**
 * Extract alpha channel from RawImage as a single-channel mask
 */
function extractAlphaMask(rawImage) {
  const { data, width, height, channels } = rawImage;
  if (channels === 1) return data;

  // Transformers.js background-removal pipeline outputs an RGBA cutout.
  // The mask we want for sliders is the alpha channel (index 3).
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    mask[i] = data[i * channels + (channels - 1)];
  }
  return mask;
}

async function loadModel(modelId, onProgress) {
  if (segmenters[modelId]) return segmenters[modelId];

  const configs = {
    modnet: { model_id: "Xenova/modnet", default_dtype: "fp32" },
    inspyrenet: {
      model_id: "OS-Software/InSPyReNet-SwinB-Plus-Ultra-ONNX",
      default_dtype: "fp16",
    },
    birefnet: {
      model_id: "TheGuy444/birefnet-web-onnx",
      default_dtype: "fp16",
    },
  };

  const config = configs[modelId] || configs["modnet"];
  const { model_id, default_dtype } = config;

  const hw = await getGPUConfig();

  // Decide best available device and precision
  let device = hw.supported && !gpuFailed ? "webgpu" : "wasm";
  // For models with only fp16 file, keep fp16; for fp16 without GPU fp16 support, use fp32
  let dtype = default_dtype;
  if (device === "webgpu" && default_dtype === "fp16" && !hw.fp16) {
    dtype = "fp32"; // Fall back to fp32 if WebGPU doesn't support fp16
  }
  // Note: WASM can run fp16 models (it just runs them in fp32 internally but still looks for fp16 file)

  onProgress?.(0.05, `Initializing ${modelId} (${device.toUpperCase()})...`);

  try {
    if (modelId === "sam2") {
      const processor = await AutoProcessor.from_pretrained(model_id);
      const model = await AutoModel.from_pretrained(model_id, {
        device: device,
        dtype: dtype,
        progress_callback: (p) => {
          if (p.status === "progress" && p.progress) {
            onProgress?.(
              0.1 + p.progress * 0.4,
              `Downloading SAM 2 (${device.toUpperCase()})... ${Math.round(p.progress)}%`,
            );
          }
        },
      });
      segmenters[modelId] = {
        segmenter: model,
        device,
        processor,
        isManual: true,
      };
    } else if (modelId === "birefnet") {
      // BiRefNet - Force WASM due to Swin architecture compatibility issues
      const birefnetDevice = "wasm";
      const processor = await AutoProcessor.from_pretrained(model_id);
      const model = await AutoModel.from_pretrained(model_id, {
        device: birefnetDevice,
        dtype: dtype,
        progress_callback: (p) => {
          if (p.status === "progress" && p.progress) {
            onProgress?.(
              0.1 + p.progress * 0.4,
              `Downloading BiRefNet (WASM)... ${Math.round(p.progress)}%`,
            );
          }
        },
      });
      segmenters[modelId] = {
        segmenter: model,
        device: birefnetDevice,
        processor,
        isManual: true,
      };
    } else if (modelId === "inspyrenet") {
      const processor = await AutoProcessor.from_pretrained(model_id);
      const model = await AutoModel.from_pretrained(model_id, {
        device: device,
        dtype: dtype,
        progress_callback: (p) => {
          if (p.status === "progress" && p.progress) {
            onProgress?.(
              0.1 + p.progress * 0.4,
              `Downloading ${modelId} (${device.toUpperCase()})... ${Math.round(p.progress)}%`,
            );
          }
        },
      });
      segmenters[modelId] = {
        segmenter: model,
        device,
        processor,
        isManual: true,
      };
    } else {
      // Standard pipelines (MODNet/InSPyReNet)
      const segmenter = await pipeline("background-removal", model_id, {
        device: device,
        dtype: dtype,
        progress_callback: (p) => {
          if (p.status === "progress" && p.progress) {
            onProgress?.(
              0.1 + p.progress * 0.4,
              `Downloading ${modelId} (${device.toUpperCase()})... ${Math.round(p.progress)}%`,
            );
          }
        },
      });
      segmenters[modelId] = {
        segmenter,
        device: segmenter.device,
        processor: null,
        isManual: false,
      };
    }
    console.log(
      `✓ ${modelId} loaded (${segmenters[modelId].device}, ${dtype})`,
    );
    return segmenters[modelId];
  } catch (err) {
    if (device === "webgpu") {
      console.warn(`[WebGPU Fallback] ${modelId} failed, trying WASM:`, err);

      // Fallback to WASM for this specific model load
      const segmenter = await pipeline("background-removal", model_id, {
        device: "wasm",
        dtype: dtype,
        progress_callback: (p) => {
          if (p.status === "progress" && p.progress) {
            onProgress?.(
              0.1 + p.progress * 0.4,
              `Loading ${modelId} (WASM)... ${Math.round(p.progress)}%`,
            );
          }
        },
      });
      segmenters[modelId] = {
        segmenter,
        device: "wasm",
        processor: null,
        isManual: false,
      };
      console.log(`✓ ${modelId} loaded (wasm, ${dtype}) via fallback`);
      return segmenters[modelId];
    }
    throw err;
  }
}

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  try {
    const { model: modelId = "modnet" } = payload || {};

    if (type === "process") {
      const { segmenter, isManual, processor } = await loadModel(
        modelId,
        (progress, message) => {
          self.postMessage({ type: "progress", progress, message });
        },
      );

      const canvas = bitmapToCanvas(payload.bitmap);
      const image = await RawImage.fromCanvas(canvas);
      lastImage = image; // Keep for refinement

      let res;
      if (isManual && (modelId === "birefnet" || modelId === "inspyrenet")) {
        self.postMessage({
          type: "progress",
          progress: 0.45,
          message: "Processing image with model...",
        });

        let mask, rawOutput;
        let maskWidth, maskHeight;

        if (modelId === "birefnet") {
          // Set resolution based on accuracy mode (Normal: 512px, High: 768px)
          const targetSize = payload.accuracyMode === 'high' ? 768 : 512;
          const { pixel_values } = await processor(image, { size: targetSize });
          // BiRefNet uses input_image key and returns output_image tensor
          const results = await segmenter({ input_image: pixel_values });
          rawOutput = results.output_image;
          const sigmoidTensor = rawOutput[0].sigmoid();
          mask = sigmoidTensor;
          maskWidth = sigmoidTensor.dims[sigmoidTensor.dims.length - 1];
          maskHeight = sigmoidTensor.dims[sigmoidTensor.dims.length - 2];

          // Store raw probabilities for refinement
          lastMask = new Float32Array(mask.data);
          lastMaskWidth = maskWidth;
          lastMaskHeight = maskHeight;
          lastMaskIsUint8 = false;
          lastMaskIsProbability = true;

          // Note: We no longer compose RGBA here to save CPU/transfer time.
          // We return the raw mask at its native resolution.
          res = {
            data: lastMask, // Use the raw probabilities
            width: maskWidth,
            height: maskHeight,
            channels: 1,
            isRaw: true,
          };

          // Properly dispose of tensors after use
          disposeTensors(pixel_values);
          if (mask !== rawOutput) disposeTensors(mask); // BiRefNet sigmoid result
          disposeTensors(rawOutput);
        } else { // InSPyReNet
          // Step 1: Intelligence Pass (Low-Res AI)
          // Normal: 384px, High: 512px. Fast even on lower-end WebGPU.
          const aiSize = payload.accuracyMode === "high" ? 512 : 384;
          const { pixel_values } = await processor(image, { size: aiSize });
          const results = await segmenter({ input: pixel_values });
          rawOutput = results.output || results.pred || results.results;

          if (!rawOutput) {
            console.error("Available keys:", Object.keys(results));
            throw new Error("Could not find mask in model output");
          }

          // Step 2: Guidance Pass (High-Res Edge Refinement)
          // We use the original image to "snap" low-res AI edges to high-res pixels.
          const targetSize = payload.accuracyMode === "high" ? 1024 : 768;
          const w = Math.min(payload.bitmap.width, targetSize);
          const h = Math.min(payload.bitmap.height, targetSize);

          // a) Prepare Guidance Image (Grayscale High-Res)
          const gCanvas = new OffscreenCanvas(w, h);
          const gCtx = gCanvas.getContext("2d");
          gCtx.drawImage(payload.bitmap, 0, 0, w, h);
          const gData = gCtx.getImageData(0, 0, w, h).data;
          const grayGuidance = toGrayscale(gData, w, h);

          // b) Prepare Initial Mask (Upscale AI result to guidance size)
          const lowResWidth = rawOutput.dims[rawOutput.dims.length - 1];
          const lowResHeight = rawOutput.dims[rawOutput.dims.length - 2];
          if (!upsampleTemp || upsampleTemp.length !== w * h) {
            upsampleTemp = new Float32Array(w * h);
          }
          const upsampledMask = resizeMaskBilinear(
            rawOutput.data,
            lowResWidth,
            lowResHeight,
            w,
            h,
            upsampleTemp,
          );

          // c) Run Guided Filter (The "Snapping" Magic)
          self.postMessage({
            type: "progress",
            progress: 0.65,
            message: "Refining edges using original image...",
          });

          // Radius 4-6 is usually good for snapping. eps 0.01^2 protects flat areas.
          lastMask = guidedFilter(upsampledMask, grayGuidance, w, h, 4, 0.0001);
          lastMaskWidth = w;
          lastMaskHeight = h;
          lastMaskIsUint8 = false;
          lastMaskIsProbability = true;

          res = {
            data: lastMask,
            width: w,
            height: h,
            channels: 1,
            isRaw: true,
          };

          // Properly dispose of tensors after use
          disposeTensors(pixel_values);
          disposeTensors(rawOutput);
        }
      } else {
        self.postMessage({
          type: "progress",
          progress: 0.45,
          message: "Processing image with model...",
        });

        // Standard pipeline path
        const output = await segmenter(image); // Get soft mask without thresholding
        res = output[0];
        lastMask = extractAlphaMask(res);
        lastMaskWidth = res.width;
        lastMaskHeight = res.height;
        lastMaskIsUint8 = true;
        lastMaskIsProbability = false;

        // Dispose of the output tensor to free memory
        disposeTensors(output);
      }

      // Unified Post-processing (Thresholding & Data Type alignment)
      // Standard pipelines return Uint8Array, manual models return Float32Array 0-1
      const maskWidth = res.width;
      const maskHeight = res.height;
      let finalData = new Uint8Array(maskWidth * maskHeight);
      const isUint8 = lastMask instanceof Uint8Array;
      const maskThreshold = payload.maskThreshold || 0.5;

      // Threshold check:
      // If probability mask [0-1], use threshold directly.
      // If Uint8Array [0-255], scale threshold.
      // If logit mask (SAM 2), use logit-style threshold.
      let t;
      if (isUint8) {
        t = maskThreshold * 255;
      } else {
        // Check if it looks like probabilities or logits
        const isProbability = lastMaskIsProbability || (lastMask[0] >= -0.1 && lastMask[0] <= 1.1);
        t = isProbability ? maskThreshold : (maskThreshold - 0.5) * 10.0;
      }

      // Apply initial thresholding to create the binary mask for display
      const shouldSharpen = modelId === 'inspyrenet' && payload.feathering === 0;

      for (let i = 0; i < maskWidth * maskHeight; i++) {
        let val = lastMask[i];
        if (shouldSharpen) {
          // Push probabilities toward 0 or 1 for cleaner edges
          val = sharpenEdgeValue(val > t ? (val - t) * 5 + 0.5 : (val / t) * 0.5, 3);
          finalData[i] = val > 0.5 ? 255 : 0;
        } else {
          finalData[i] = lastMask[i] > t ? 255 : 0;
        }
      }

      // Apply feathering if requested on first pass
      if (payload.feathering > 0) {
        self.postMessage({
          type: "progress",
          progress: 0.75,
          message: "Applying feathering...",
        });
        applyFeathering(
          finalData,
          maskWidth,
          maskHeight,
          payload.feathering,
        );
      }

      payload.bitmap.close();

      self.postMessage(
        {
          type: "complete",
          result: {
            pixelData: finalData.buffer,
            width: maskWidth,
            height: maskHeight,
            channels: 1, // Significant optimization: Returning 1-channel mask only
            isRaw: true,
          },
        },
        [finalData.buffer],
      );
    }

    if (type === "refine") {
      if (!lastMask || !lastImage) {
        throw new Error("No image loaded to refine.");
      }

      const { maskThreshold = 0.5, feathering = 0 } = payload;
      const width = lastMaskWidth;
      const height = lastMaskHeight;

      let mask = new Uint8Array(width * height);

      // 1. Thresholding
      const isUint8 = lastMaskIsUint8;
      const isProbability = lastMaskIsProbability || (!isUint8 && lastMask[0] >= 0 && lastMask[0] <= 1);

      let t;
      if (isUint8) {
        t = maskThreshold * 255;
      } else if (isProbability) {
        t = maskThreshold;
      } else {
        t = (maskThreshold - 0.5) * 10.0; // SAM 2 Logits
      }

      for (let i = 0; i < lastMask.length; i++) {
        mask[i] = lastMask[i] > t ? 255 : 0;
      }

      // 2. Feathering
      if (feathering > 0) {
        applyFeathering(mask, width, height, feathering);
      }

      self.postMessage(
        {
          type: "complete",
          result: {
            pixelData: mask.buffer,
            width,
            height,
            channels: 1,
            isRaw: true,
          },
        },
        [mask.buffer],
      );
    }

    if (type === "clear") {
      // Properly dispose of tensors when clearing
      if (lastMask) {
        lastMask = null;
      }
      if (lastImage) {
        lastImage = null;
      }
      lastMaskIsUint8 = false;
      lastMaskIsProbability = false;

      // Also clear model cache if requested (though we usually want to keep them for speed)
      if (payload.clearModels) {
        Object.keys(segmenters).forEach((id) => {
          const modelObj = segmenters[id];
          if (
            modelObj.segmenter &&
            typeof modelObj.segmenter.dispose === "function"
          ) {
            modelObj.segmenter.dispose();
          }
          delete segmenters[id];
        });
      }

      self.postMessage({ type: "clear-complete" });
    }
  } catch (err) {
    self.postMessage({ type: "error", error: err.message });
  }
};
