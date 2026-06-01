/**
 * Object Segmentation Worker (Transformers.js v4)
 * Runs SlimSAM / SAM-2 model in a separate thread
 */

import { SamModel, Sam2Model, AutoProcessor, RawImage, env } from '@huggingface/transformers';
import { getGPUConfig, createProgressReporter } from '../../core/worker-utils.js';
import { SEGMENTATION_MODELS } from '../../config/models.js';
import { extractMaskBitmap } from './helpers.js';

env.allowLocalModels = false;


let model = null;
let processor = null;

// Global cache for performance
let currentModelId = null;
let cachedEmbeddings = null;
let lastImageInputs = null;
let cachedRawImage = null;
let cachedPixelValues = null;
let cachedOriginalSizes = null;
let cachedReshapedInputSizes = null;

function clearCache() {
  if (cachedPixelValues?.dispose) {
    try { cachedPixelValues.dispose(); } catch (_) {}
  }
  cachedPixelValues = null;

  if (cachedEmbeddings) {
    for (const key in cachedEmbeddings) {
      if (cachedEmbeddings[key]?.dispose) {
        try { cachedEmbeddings[key].dispose(); } catch (_) {}
      }
    }
    cachedEmbeddings = null;
  }

  cachedRawImage = null;
  lastImageInputs = null;
  cachedOriginalSizes = null;
  cachedReshapedInputSizes = null;
}







self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === 'process') {
    try {
      const modelId = payload.modelId || SEGMENTATION_MODELS.slimsam.model_id;



      if (!model || !processor || modelId !== currentModelId) {
        const onProgress = (prog, msg) => self.postMessage({ type: 'progress', progress: prog, message: msg });
        const report = createProgressReporter(onProgress);

        let modelDisplayName = 'SAM';
        if (modelId.includes('sam2')) modelDisplayName = 'SAM-2';
        else if (modelId.includes('slimsam')) modelDisplayName = 'SlimSAM';

        report(0.1, 0.1, `Loading ${modelDisplayName} model...`)(0);

        // Clear cache if switching models
        if (modelId !== currentModelId) {
          clearCache();
          currentModelId = modelId;
        }

        const modelClass = modelId.includes('sam2') ? Sam2Model : SamModel;

        const hw = await getGPUConfig();
        const device = hw.supported ? 'webgpu' : 'wasm';

        // Force fp32 for stability with SAM models on WebGPU.
        // fp16 often causes MatMul shader compilation errors in browsers.
        const dtype = 'fp32';

        model = await modelClass.from_pretrained(modelId, {
          device,
          dtype,
          progress_callback: report(0.1, 0.45, "Downloading model..."),
        });

        report(0.45, 0.45, 'Loading processor...')(0);
        processor = await AutoProcessor.from_pretrained(modelId);
      }


      self.postMessage({ type: 'progress', progress: 0.5, message: 'Processing image...' });

      let currentInputs = null;
      if (payload.bitmap) {
        // New image: Clear old heavy assets first to prevent memory peak
        clearCache();

        // New image: Run the heavy Encoder
        // Reuse an internal canvas for the bitmap-to-RawImage conversion
        const canvas = new OffscreenCanvas(payload.bitmap.width, payload.bitmap.height);
        canvas.getContext('2d').drawImage(payload.bitmap, 0, 0);
        cachedRawImage = await RawImage.fromCanvas(canvas);

        // Pre-process image metadata
        lastImageInputs = await processor(cachedRawImage);

        // Cache preprocessed metadata and pixel values to satisfy model input signature
        cachedOriginalSizes = JSON.parse(JSON.stringify(lastImageInputs.original_sizes));
        cachedReshapedInputSizes = JSON.parse(JSON.stringify(lastImageInputs.reshaped_input_sizes));
        cachedPixelValues = lastImageInputs.pixel_values;

        // Generate and cache embeddings
        self.postMessage({ type: 'progress', progress: 0.55, message: 'Encoding image features...' });
        cachedEmbeddings = await model.get_image_embeddings(lastImageInputs);

        lastImageInputs = null;

        payload.bitmap.close();
        payload.bitmap = null; // Prevent the double-close guard below from firing erroneously
      }

      if (!cachedRawImage || !cachedEmbeddings) {
        throw new Error('No image loaded and no cached embeddings found.');
      }

      self.postMessage({ type: 'progress', progress: 0.6, message: 'Preparing refinement inputs...' });

      // Fast Path: Manually build refinement inputs bypassing heavy processor image resize & normalize steps
      currentInputs = {
        original_sizes: cachedOriginalSizes,
        reshaped_input_sizes: cachedReshapedInputSizes,
        pixel_values: cachedPixelValues
      };

      if (payload.points && payload.points.length > 0) {
        const mappedPoints = payload.points.map(p => [p.x * cachedRawImage.width, p.y * cachedRawImage.height]);
        const mappedLabels = payload.points.map(p => p.label);

        currentInputs.input_points = processor.image_processor.reshape_input_points(
          [ [ mappedPoints ] ],
          cachedOriginalSizes,
          cachedReshapedInputSizes
        );

        currentInputs.input_labels = processor.image_processor.add_input_labels(
          [ [ mappedLabels ] ],
          currentInputs.input_points
        );
      }

      // Add bounding box if provided (from brush painting)
      if (payload.box) {
        const [nx1, ny1, nx2, ny2] = payload.box;
        const mappedBox = [
          nx1 * cachedRawImage.width,
          ny1 * cachedRawImage.height,
          nx2 * cachedRawImage.width,
          ny2 * cachedRawImage.height
        ];

        currentInputs.input_boxes = processor.image_processor.reshape_input_points(
          [ [ [ mappedBox ] ] ],
          cachedOriginalSizes,
          cachedReshapedInputSizes,
          true
        );
      }

      self.postMessage({ type: 'progress', progress: 0.65, message: 'Running decoder...' });

      // Run Decoder (Fast Pass)
      const outputs = await model({
        ...currentInputs,
        image_embeddings: cachedEmbeddings
      });

      self.postMessage({ type: 'progress', progress: 0.8, message: 'Generating mask...' });

      // Post-process masks
      const predMasks = outputs.pred_masks || outputs.masks || (Array.isArray(outputs) ? outputs[0] : null);
      if (!predMasks) {
        throw new Error('Inference failed: Model returned no masks.');
      }

      const masks = await processor.post_process_masks(
        predMasks,
        cachedOriginalSizes,
        cachedReshapedInputSizes
      );

      if (!masks || masks.length === 0) {
        throw new Error('Post-processing failed: Result array is empty.');
      }

      // Return all 3 masks (small, medium, large context)
      const maskTensor = masks[0];
      const [batch, numMasks, H, W] = maskTensor.dims;

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

      self.postMessage({
        type: 'complete',
        result: {
          options: results,
          mode: payload.mode
        }
      }, transferables);

      // Note: cachedEmbeddings is intentionally preserved for hot-refinement loop.
      // Aggressive disposal was causing "Device Lost" on fast refinement cycles.
      // payload.bitmap is already closed above (or null if this was a same-image refinement).
    } catch (error) {
      // Hardware Recovery: If WebGPU device is lost, force reload on next call
      if (error.message.includes('lost') || error.message.includes('GPUBuffer') || error.message.includes('AbortError')) {
        model = null;
        processor = null;
        clearCache();
      }

      self.postMessage({ type: 'error', error: error.message });
    } finally {
      // Dispose intermediate tensors to prevent memory accumulation in worker thread
      if (currentInputs) {
        if (currentInputs.input_points?.dispose) { try { currentInputs.input_points.dispose(); } catch (_) {} }
        if (currentInputs.input_labels?.dispose) { try { currentInputs.input_labels.dispose(); } catch (_) {} }
        if (currentInputs.input_boxes?.dispose) { try { currentInputs.input_boxes.dispose(); } catch (_) {} }
      }
    }
  } else if (type === 'clear') {
    clearCache();
  } else if (type === 'dispose') {
    clearCache();
    if (model?.dispose) { try { model.dispose(); } catch (_) {} }
    model = null;
    processor = null;
    currentModelId = null;
  }
};
