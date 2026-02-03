import { pipeline, env, AutoModel, AutoModelForImageSegmentation, AutoProcessor, RawImage, Tensor } from '@huggingface/transformers';

// Environment config for fastest loading
env.allowLocalModels = false;
env.useBrowserCache = true;  // Cache model in IndexedDB

// Cache for loaded models
const segmenters = {};

// Hardware support state
let gpuConfig = null;
let gpuFailed = false;

// Raw mask data (Float32Array) for instant refinement
let lastMask = null;
let lastImage = null; // Store for refinement (RawImage)


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
    const hasFP16 = adapter.features.has('shader-f16');
    gpuConfig = { supported: true, fp16: hasFP16 };
  } catch (err) {
    console.warn('WebGPU check failed:', err);
    gpuConfig = { supported: false, fp16: false };
  }

  return gpuConfig;
}

/**
 * Safely dispose of all tensors in an object or array
 */
function disposeTensors(obj) {
  if (!obj) return;
  if (obj && typeof obj.dispose === 'function') {
    obj.dispose();
  } else if (Array.isArray(obj)) {
    obj.forEach(disposeTensors);
  } else if (typeof obj === 'object') {
    Object.values(obj).forEach(item => {
      if (item && typeof item.dispose === 'function') {
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
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

/**
 * Apply Box Blur to alpha channel for feathering
 * Efficient 1D passes to avoid heavy computation
 */
function applyFeathering(data, width, height, radius) {
    if (radius <= 0) return data;

    const result = new Uint8Array(data.length);
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

    const intermediate = new Uint8Array(result);
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
    'modnet': { model_id: 'Xenova/modnet', default_dtype: 'fp32' },
    'inspyrenet': { model_id: 'TheGuy444/InSpyReNet-Res2Net50', default_dtype: 'fp16' },
    'birefnet': { model_id: 'TheGuy444/birefnet-web-onnx', default_dtype: 'fp16' }
  };

  const config = configs[modelId] || configs['modnet'];
  const { model_id, default_dtype } = config;

  const hw = await getGPUConfig();

  // Decide best available device and precision
  let device = (hw.supported && !gpuFailed) ? 'webgpu' : 'wasm';
  // For models with only fp16 file, keep fp16; for fp16 without GPU fp16 support, use fp32
  let dtype = default_dtype;
  if (device === 'webgpu' && default_dtype === 'fp16' && !hw.fp16) {
    dtype = 'fp32'; // Fall back to fp32 if WebGPU doesn't support fp16
  }
  // Note: WASM can run fp16 models (it just runs them in fp32 internally but still looks for fp16 file)

  onProgress?.(0.05, `Initializing ${modelId} (${device.toUpperCase()})...`);

  try {
    if (modelId === 'sam2') {
      const processor = await AutoProcessor.from_pretrained(model_id);
      const model = await AutoModel.from_pretrained(model_id, {
        device: device,
        dtype: dtype,
        progress_callback: (p) => {
          if (p.status === 'progress' && p.progress) {
            onProgress?.(0.1 + p.progress * 0.4, `Downloading SAM 2 (${device.toUpperCase()})... ${Math.round(p.progress)}%`);
          }
        },
      });
      segmenters[modelId] = { segmenter: model, device, processor, isManual: true };
    } else if (modelId === 'birefnet') {
      // BiRefNet - Force WASM due to Swin architecture compatibility issues
      const birefnetDevice = 'wasm';
      const processor = await AutoProcessor.from_pretrained(model_id);
      const model = await AutoModel.from_pretrained(model_id, {
        device: birefnetDevice,
        dtype: dtype,
        progress_callback: (p) => {
          if (p.status === 'progress' && p.progress) {
            onProgress?.(0.1 + p.progress * 0.4, `Downloading BiRefNet (WASM)... ${Math.round(p.progress)}%`);
          }
        },
      });
      segmenters[modelId] = { segmenter: model, device: birefnetDevice, processor, isManual: true };
    } else if (modelId === 'inspyrenet') {
        const processor = await AutoProcessor.from_pretrained(model_id);
        const model = await AutoModel.from_pretrained(model_id, {
          device: device,
          dtype: dtype,
          progress_callback: (p) => {
            if (p.status === 'progress' && p.progress) {
              onProgress?.(0.1 + p.progress * 0.4, `Downloading ${modelId} (${device.toUpperCase()})... ${Math.round(p.progress)}%`);
            }
          },
        });
        segmenters[modelId] = { segmenter: model, device, processor, isManual: true };
    } else {
      // Standard pipelines (MODNet/InSPyReNet)
      const segmenter = await pipeline('background-removal', model_id, {
        device: device,
        dtype: dtype,
        progress_callback: (p) => {
          if (p.status === 'progress' && p.progress) {
            onProgress?.(0.1 + p.progress * 0.4, `Downloading ${modelId} (${device.toUpperCase()})... ${Math.round(p.progress)}%`);
          }
        },
      });
      segmenters[modelId] = { segmenter, device: segmenter.device, processor: null, isManual: false };
    }

    console.log(`✓ ${modelId} loaded (${segmenters[modelId].device}, ${dtype})`);
    return segmenters[modelId];

  } catch (err) {
    if (device === 'webgpu') {
      console.warn(`[WebGPU Fallback] ${modelId} failed, trying WASM:`, err);

      // Fallback to WASM for this specific model load
      const segmenter = await pipeline('background-removal', model_id, {
        device: 'wasm',
        dtype: dtype,
        progress_callback: (p) => {
          if (p.status === 'progress' && p.progress) {
            onProgress?.(0.1 + p.progress * 0.4, `Loading ${modelId} (WASM)... ${Math.round(p.progress)}%`);
          }
        },
      });
      segmenters[modelId] = { segmenter, device: 'wasm', processor: null, isManual: false };
      console.log(`✓ ${modelId} loaded (wasm, ${dtype}) via fallback`);
      return segmenters[modelId];
    }
    throw err;
  }
}

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  try {
    const { model: modelId = 'modnet' } = payload || {};


    if (type === 'process') {
      const { segmenter, isManual, processor } = await loadModel(modelId, (progress, message) => {
        self.postMessage({ type: 'progress', progress, message });
      });

      const canvas = bitmapToCanvas(payload.bitmap);
      const image = await RawImage.fromCanvas(canvas);
      lastImage = image; // Keep for refinement

      let res;
      if (isManual && (modelId === 'birefnet' || modelId === 'inspyrenet')) {
        const { pixel_values } = await processor(image);
        let mask, rawOutput;
        let maskWidth, maskHeight;

        if (modelId === 'birefnet') {
          // BiRefNet uses input_image key and returns output_image tensor
          const results = await segmenter({ input_image: pixel_values });
          rawOutput = results.output_image;
          const sigmoidTensor = rawOutput[0].sigmoid();
          mask = sigmoidTensor;
          maskWidth = sigmoidTensor.dims[sigmoidTensor.dims.length - 1];
          maskHeight = sigmoidTensor.dims[sigmoidTensor.dims.length - 2];
        } else {
          // InSPyReNet uses 'input' key and returns mask directly
          const results = await segmenter({ input: pixel_values });
          rawOutput = results.output;
          // InSpyReNet output is already sigmoided/normalized in our wrapper
          mask = rawOutput;
          maskWidth = rawOutput.dims[rawOutput.dims.length - 1];
          maskHeight = rawOutput.dims[rawOutput.dims.length - 2];
        }

        // Store raw probabilities for refinement
        lastMask = new Float32Array(mask.data);

        // Compose RGBA output (image + mask as alpha)
        const width = image.width;
        const height = image.height;
        const channels = image.channels || 3;
        const imgData = image.data;
        const rgba = new Uint8Array(width * height * 4);

        // Scale mask to image dimensions if needed
        const scaleX = maskWidth / width;
        const scaleY = maskHeight / height;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const idx = i * 4;
            const srcIdx = i * channels;

            // Sample mask with bilinear interpolation for much smoother edges
            const gx = x * scaleX;
            const gy = y * scaleY;
            const gxi = Math.floor(gx);
            const gyi = Math.floor(gy);
            const gxf = gx - gxi;
            const gyf = gy - gyi;

            const x0 = gxi;
            const x1 = Math.min(gxi + 1, maskWidth - 1);
            const y0 = gyi;
            const y1 = Math.min(gyi + 1, maskHeight - 1);

            const c00 = lastMask[y0 * maskWidth + x0];
            const c10 = lastMask[y0 * maskWidth + x1];
            const c01 = lastMask[y1 * maskWidth + x0];
            const c11 = lastMask[y1 * maskWidth + x1];

            const rawAlpha = c00 * (1 - gxf) * (1 - gyf) +
                             c10 * gxf * (1 - gyf) +
                             c01 * (1 - gxf) * gyf +
                             c11 * gxf * gyf;

            // Sharpen edges to reduce fuzziness from upscaling
            const alpha = sharpenEdgeValue(rawAlpha) * 255;

            rgba[idx] = imgData[srcIdx];
            rgba[idx + 1] = imgData[srcIdx + 1];
            rgba[idx + 2] = imgData[srcIdx + 2];
            rgba[idx + 3] = alpha;
          }
        }

        res = { data: rgba, width, height, channels: 4 };

        // Store a properly interpolated mask for refinement (bilinear, matching alpha)
        const resizedMask = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const gx = x * scaleX;
            const gy = y * scaleY;
            const gxi = Math.floor(gx);
            const gyi = Math.floor(gy);
            const gxf = gx - gxi;
            const gyf = gy - gyi;

            const x0 = gxi;
            const x1 = Math.min(gxi + 1, maskWidth - 1);
            const y0 = gyi;
            const y1 = Math.min(gyi + 1, maskHeight - 1);

            const c00 = lastMask[y0 * maskWidth + x0];
            const c10 = lastMask[y0 * maskWidth + x1];
            const c01 = lastMask[y1 * maskWidth + x0];
            const c11 = lastMask[y1 * maskWidth + x1];

            resizedMask[y * width + x] = c00 * (1 - gxf) * (1 - gyf) +
                                          c10 * gxf * (1 - gyf) +
                                          c01 * (1 - gxf) * gyf +
                                          c11 * gxf * gyf;
          }
        }
        lastMask = resizedMask;

        disposeTensors(pixel_values);
        if (mask !== rawOutput) disposeTensors(mask); // BiRefNet sigmoid result
        disposeTensors(rawOutput);
      } else {
        // Standard pipeline path
        const output = await segmenter(image); // Get soft mask without thresholding
        res = output[0];
        lastMask = extractAlphaMask(res);
      }

      let finalData = res.data;

      // Only apply thresholding/binary mask if NOT using a manual soft-mask path
      if (!isManual) {
        const isUint8 = lastMask instanceof Uint8Array;
        const maskThreshold = payload.maskThreshold || 0.5;

        // Threshold check:
        // If probability mask [0-1], use threshold directly.
        // If logit mask, use logit-style threshold.
        const t = isUint8 ? maskThreshold * 255 : (maskThreshold - 0.5) * 10.0;

        // Apply initial manual thresholding to the alpha channel
        for (let i = 0; i < res.width * res.height; i++) {
            finalData[i * res.channels + (res.channels - 1)] = lastMask[i] > t ? 255 : 0;
        }
      }

      // Apply feathering if requested on first pass
      if (payload.feathering > 0) {
          const width = res.width;
          const height = res.height;
          const channels = res.channels;
          const mask = extractAlphaMask(res);
          const feathered = applyFeathering(mask, width, height, payload.feathering);

          // Update alpha channel in output
          for (let i = 0; i < width * height; i++) {
              finalData[i * channels + (channels - 1)] = feathered[i];
          }
      }

      payload.bitmap.close(); // Important: Release memory promptly
      self.postMessage({
        type: 'complete',
        result: { pixelData: res.data.buffer, width: res.width, height: res.height }
      }, [res.data.buffer]);
    }

    if (type === 'refine') {
      if (!lastMask || !lastImage) {
        throw new Error('No image loaded to refine.');
      }

      const { threshold = 0.5, maskThreshold = 0.5, feathering = 0 } = payload;
      const { width, height, channels = 3, data: imgData } = lastImage;

      const rgba = new Uint8Array(width * height * 4);
      let mask = new Uint8Array(width * height);

      // 1. Thresholding (Scale threshold based on data type)
      const isUint8 = lastMask instanceof Uint8Array;

      // Determine if this is a probability mask [0-1] or a logit mask (SAM 2)
      // Usually logits are strongly negative/positive, while probabilities are 0-1.
      const isProbability = !isUint8 && lastMask[0] >= 0 && lastMask[0] <= 1 && lastMask[lastMask.length - 1] <= 1;

      let t;
      if (isUint8) {
        t = maskThreshold * 255;
      } else if (isProbability) {
        t = maskThreshold; // [0-1]
      } else {
        t = (maskThreshold - 0.5) * 10.0; // SAM 2 Logits
      }

      for (let i = 0; i < lastMask.length; i++) {
        mask[i] = lastMask[i] > t ? 255 : 0;
      }

      // 2. Feathering
      if (feathering > 0) {
        mask = applyFeathering(mask, width, height, feathering);
      }

      // 3. Assemble RGBA
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const srcIdx = i * channels;
        const alpha = mask[i];

        rgba[idx] = imgData[srcIdx];
        rgba[idx + 1] = imgData[srcIdx + 1];
        rgba[idx + 2] = imgData[srcIdx + 2];
        rgba[idx + 3] = alpha;
      }

      self.postMessage({
        type: 'complete',
        result: { pixelData: rgba.buffer, width, height }
      }, [rgba.buffer]);
    }

    if (type === 'clear') {
      lastMask = null;
      lastImage = null;

      // Also clear model cache if requested (though we usually want to keep them for speed)
      if (payload.clearModels) {
        Object.keys(segmenters).forEach(id => delete segmenters[id]);
      }

      self.postMessage({ type: 'clear-complete' });
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message });
  }
};
