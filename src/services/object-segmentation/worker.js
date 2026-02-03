/**
 * Object Segmentation Worker
 * Runs SlimSAM model in a separate thread
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
  if (cachedRawImage) {
    // No explicit close() on RawImage usually, but we can nullify
    cachedRawImage = null;
  }
  cachedEmbeddings = null;
  lastImageInputs = null;
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

self.onmessage = async ({ data }) => {
  const { type, payload } = data;
  console.log('[Worker] Message received:', type);

  if (type === 'process') {
    try {
      // Initialize model if needed
      const modelId = payload.modelId || 'Xenova/slimsam-77-uniform';

      if (!model || !processor || modelId !== currentModelId) {
        self.postMessage({ type: 'progress', progress: 0.1, message: `Loading ${modelId.includes('sam2') ? 'SAM-2' : 'SlimSAM'} model...` });

        // Clear cache if switching models
        if (modelId !== currentModelId) {
            clearCache();
            currentModelId = modelId;
        }

        const modelClass = modelId.includes('sam2') ? Sam2Model : SamModel;

        model = await modelClass.from_pretrained(modelId, {
          device: 'webgpu',
          dtype: 'fp16',
          progress_callback: (p) => {
            if (p.status === 'progress' && p.progress) {
              self.postMessage({
                type: 'progress',
                progress: 0.1 + p.progress * 0.3,
                message: `Downloading model... ${Math.round(p.progress)}%`
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
          const canvas = bitmapToCanvas(payload.bitmap);
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

      // Map normalized coordinates (0..1) back to the actual AI input domain
      const isSam2 = currentModelId.includes('sam2');

      // SAM-1 (SlimSAM) expects [ [[x, y], ...] ] (batch, point, coord)
      // SAM-2 expects [ [ [[x, y], ...] ] ] (batch, object, point, coord)
      const input_points = isSam2
        ? [ [ payload.points.map(p => [p.x * cachedRawImage.width, p.y * cachedRawImage.height]) ] ]
        : [ payload.points.map(p => [p.x * cachedRawImage.width, p.y * cachedRawImage.height]) ];

      const input_labels = isSam2
        ? [ [ payload.points.map(p => p.label) ] ]
        : [ payload.points.map(p => p.label) ];

      self.postMessage({ type: 'progress', progress: 0.6, message: 'Preparing refinement inputs...' });
      const currentInputs = await processor(cachedRawImage, { input_points, input_labels });

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
        currentInputs.reshaped_input_sizes, // Optimization: Post-process to AI domain (1024px) instead of Original (4K)
        currentInputs.reshaped_input_sizes
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

        // Optimization: Pre-convert to Uint8Array (0/255) in worker
        // This offloads work from the main thread and allows Transferable use
        const uint8Mask = new Uint8Array(maskSize);
        for(let j=0; j < maskSize; j++) {
            uint8Mask[j] = data[j] > 0 ? 255 : 0;
        }

        results.push({
          maskData: uint8Mask,
          maskWidth: W,
          maskHeight: H,
          scaleIndex: i
        });
        transferables.push(uint8Mask.buffer);
      }

      console.log('[Worker] Inference complete, sending results');
      self.postMessage({
        type: 'complete',
        result: {
          options: results,
          mode: payload.mode
        }
      }, transferables);

      // Transformers.js manages tensor lifecycles internally.
      // Aggressive disposal of all output values was causing "Device Lost"
      // when refinement loops were fast, as the model was losing its decoder state.
      // We only close the bitmap here.
      // Note: we keep cachedEmbeddings preserved for refinement

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
