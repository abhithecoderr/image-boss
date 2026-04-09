/**
 * Object Segmentation Worker (Transformers.js v4)
 * Runs SlimSAM / SAM-2 model in a separate thread
 */

import { SamModel, Sam2Model, AutoProcessor, RawImage, env } from '@huggingface/transformers';

env.allowLocalModels = false;

let model = null;
let processor = null;

// Global cache for performance
let currentModelId = null;
let cachedEmbeddings = null;
let lastImageInputs = null;
let cachedRawImage = null;

function clearCache() {
  console.log('[Worker] Clearing memory cache...');
  cachedRawImage = null;
  cachedEmbeddings = null;
  lastImageInputs = null;
}

/**
 * Detect WebGPU and fp16 support — mirrors bg-removal pattern
 */
async function getGPUConfig() {
  if (!navigator.gpu) return { supported: false, fp16: false };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { supported: false, fp16: false };
    const hasFP16 = adapter.features.has('shader-f16');
    return { supported: true, fp16: hasFP16 };
  } catch (_) {
    return { supported: false, fp16: false };
  }
}

/**
 * Convert mask tensor to ImageBitmap
 */
let workerMaskCanvas = null;
let workerMaskCtx = null;

async function extractMaskBitmap(data, width, height) {
  if (!workerMaskCanvas || workerMaskCanvas.width !== width || workerMaskCanvas.height !== height) {
    workerMaskCanvas = new OffscreenCanvas(width, height);
    workerMaskCtx = workerMaskCanvas.getContext('2d', { alpha: true });
  }

  const imageData = workerMaskCtx.createImageData(width, height);
  const data32 = new Uint32Array(imageData.data.buffer);

  // High-performance thresholding and pixel packing
  // Most modern browsers are Little Endian (RGBA in memory order)
  for (let i = 0; i < data.length; i++) {
    const val = data[i] > 0 ? 255 : 0;
    // Pack as AABBGGRR (Little Endian maps to [R, G, B, A] in memory)
    data32[i] = (val << 24) | 0x00ffffff;
  }

  workerMaskCtx.putImageData(imageData, 0, 0);
  return await createImageBitmap(workerMaskCanvas);
}



self.onmessage = async ({ data }) => {
  const { type, payload } = data;
  console.log('[Worker] Message received:', type);

  if (type === 'process') {
    try {
      const modelId = payload.modelId || 'Xenova/slimsam-77-uniform';

      if (!model || !processor || modelId !== currentModelId) {
        self.postMessage({ type: 'progress', progress: 0.1, message: `Loading ${modelId.includes('sam2') ? 'SAM-2' : 'SlimSAM'} model...` });

        // Clear cache if switching models
        if (modelId !== currentModelId) {
          clearCache();
          currentModelId = modelId;
        }

        const modelClass = modelId.includes('sam2') ? Sam2Model : SamModel;

        // v4: dynamic device/dtype with fp16 guard (no longer hardcoded)
        const hw = await getGPUConfig();
        const device = hw.supported ? 'webgpu' : 'wasm';
        const dtype = (hw.supported && hw.fp16) ? 'fp16' : 'fp32';

        console.info(`[Worker] Loading ${modelId} on ${device} (${dtype})`);

        model = await modelClass.from_pretrained(modelId, {
          device,
          dtype,
          progress_callback: (p) => {
            // v4: primary fields are loaded/total; legacy p.progress kept as fallback
            if (p.status === 'progress') {
              const pct = p.total
                ? ((p.loaded ?? 0) / p.total) * 100
                : (p.progress ?? 0);
              self.postMessage({
                type: 'progress',
                progress: 0.1 + (pct / 100) * 0.3,
                message: `Downloading model... ${Math.round(pct)}%`
              });
            }
          },
        });

        self.postMessage({ type: 'progress', progress: 0.45, message: 'Loading processor...' });
        processor = await AutoProcessor.from_pretrained(modelId);

      }

      self.postMessage({ type: 'progress', progress: 0.5, message: 'Processing image...' });

      let inputs = {};
      if (payload.bitmap) {
        // New image: Clear old heavy assets first to prevent memory peak
        clearCache();

        // New image: Run the heavy Encoder
        console.log('[Worker] New image detected. Encoding...');
        // Reuse an internal canvas for the bitmap-to-RawImage conversion
        const canvas = new OffscreenCanvas(payload.bitmap.width, payload.bitmap.height);
        canvas.getContext('2d').drawImage(payload.bitmap, 0, 0);
        cachedRawImage = await RawImage.fromCanvas(canvas);

        // Pre-process image metadata
        lastImageInputs = await processor(cachedRawImage);

        // Generate and cache embeddings
        self.postMessage({ type: 'progress', progress: 0.55, message: 'Encoding image features...' });
        cachedEmbeddings = await model.get_image_embeddings(lastImageInputs);
        console.log('[Worker] Image encoded and cached.');

        payload.bitmap.close();
      }

      if (!cachedRawImage || !cachedEmbeddings) {
        throw new Error('No image loaded and no cached embeddings found.');
      }

      // Build processor options
      const processorOpts = {};

      if (payload.points && payload.points.length > 0) {
        const mappedPoints = payload.points.map(p => [p.x * cachedRawImage.width, p.y * cachedRawImage.height]);
        const mappedLabels = payload.points.map(p => p.label);

        // SAM / SAM-2 unified API requires a 4D tensor: [batch_size, point_batch_size, nb_points_per_image, 2]
        processorOpts.input_points = [ [ mappedPoints ] ];
        processorOpts.input_labels = [ [ mappedLabels ] ];
      }

      // Add bounding box if provided (from brush painting)
      // Format: [[[x1, y1, x2, y2]]] in raw pixel coordinates -> shape [batch, box_batch_size, 4]
      if (payload.box) {
        const [nx1, ny1, nx2, ny2] = payload.box;
        processorOpts.input_boxes = [[ [
          nx1 * cachedRawImage.width,
          ny1 * cachedRawImage.height,
          nx2 * cachedRawImage.width,
          ny2 * cachedRawImage.height
        ] ]];
      }

      self.postMessage({ type: 'progress', progress: 0.6, message: 'Preparing refinement inputs...' });
      const currentInputs = await processor(cachedRawImage, processorOpts);

      self.postMessage({ type: 'progress', progress: 0.65, message: 'Running decoder...' });

      // Run Decoder (Fast Pass)
      const outputs = await model({
        ...currentInputs,
        image_embeddings: cachedEmbeddings
      });

      console.log('[Worker] Model outputs keys:', Object.keys(outputs));

      self.postMessage({ type: 'progress', progress: 0.8, message: 'Generating mask...' });

      // Post-process masks
      const predMasks = outputs.pred_masks || outputs.masks || (Array.isArray(outputs) ? outputs[0] : null);
      if (!predMasks) {
        console.error('[Worker] Fatal: No masks in model output', outputs);
        throw new Error('Inference failed: Model returned no masks.');
      }

      const masks = await processor.post_process_masks(
        predMasks,
        currentInputs.reshaped_input_sizes,
        currentInputs.original_sizes // Upscale masks to original image resolution for precise edges
      );

      console.log('[Worker] Post-processed masks count:', masks?.length);

      if (!masks || masks.length === 0) {
        throw new Error('Post-processing failed: Result array is empty.');
      }

      // Return all 3 masks (small, medium, large context)
      const maskTensor = masks[0];
      const [batch, numMasks, H, W] = maskTensor.dims;
      console.log('[Worker] Mask tensor dimensions:', maskTensor.dims);

      const results = [];
      const maskSize = H * W;
      const transferables = [];

      for (let i = 0; i < numMasks; i++) {
        const data = maskTensor.data.subarray(i * maskSize, (i + 1) * maskSize);
        const maskBitmap = await extractMaskBitmap(data, W, H);

        results.push({
          maskBitmap,
          maskWidth: W,
          maskHeight: H,
          scaleIndex: i
        });
        transferables.push(maskBitmap);
      }

      console.log('[Worker] Inference complete, sending ImageBitmaps');
      self.postMessage({
        type: 'complete',
        result: {
          options: results,
          mode: payload.mode
        }
      }, transferables);

      // Note: cachedEmbeddings is intentionally preserved for hot-refinement loop.
      // Aggressive disposal was causing "Device Lost" on fast refinement cycles.
      payload.bitmap?.close();
    } catch (error) {
      console.error('[Worker] Error:', error);

      // Hardware Recovery: If WebGPU device is lost, force reload on next call
      if (error.message.includes('lost') || error.message.includes('GPUBuffer') || error.message.includes('AbortError')) {
        console.warn('[Worker] Fatal WebGPU error detected. Invalidating model/processor.');
        model = null;
        processor = null;
        clearCache();
      }

      self.postMessage({ type: 'error', error: error.message });
    }
  } else if (type === 'clear') {
    clearCache();
  }
};
