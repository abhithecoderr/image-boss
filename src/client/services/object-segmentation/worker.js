/**
 * Object Segmentation Worker (Transformers.js v4)
 * Runs SlimSAM / SAM-2 model in a separate thread
 */

import { SamModel, Sam2Model, AutoProcessor, env } from '@huggingface/transformers';
import { getGPUConfig, createProgressReporter, bitmapToRawImage, canvasCache } from '../../utils/worker-utils.js';
import { SEGMENTATION_MODELS } from '../../config/models.js';
import { extractMaskBitmap } from './helpers.js';

env.allowLocalModels = false;
env.useWasmCache = false; // Disable buggy/redundant WASM preloader cache

if (env.backends?.onnx) {
  env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';
  env.backends.onnx.wasm.numThreads = Math.min(4, self.navigator?.hardwareConcurrency || 4);
  if (!env.backends.onnx.webgpu) {
    env.backends.onnx.webgpu = {};
  }
  // Request dedicated GPU to avoid integrated GPU Tint WGSL compiler bugs
  env.backends.onnx.webgpu.powerPreference = 'high-performance';
}

let model = null;
let processor = null;
let currentModelId = null;
let currentDevice = null;

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === 'process') {
    let inputs = null;
    try {
      const modelId = payload.modelId || SEGMENTATION_MODELS.sam2_1_tiny.model_id;

      // Load model and processor if not loaded or if switching models
      if (!model || !processor || modelId !== currentModelId) {
        const onProgress = (prog, msg) => self.postMessage({ type: 'progress', progress: prog, message: msg });
        const report = createProgressReporter(onProgress);

        const modelDisplayName = modelId.includes('sam2') ? 'SAM 2.1' : 'SAM';
        report(0.1, 0.1, `Loading ${modelDisplayName} model...`)(0);

        const modelClass = modelId.includes('sam2') ? Sam2Model : SamModel;
        const hw = await getGPUConfig();
        const device = hw.supported ? 'webgpu' : 'wasm';
        
        // Look up model config to determine dtype dynamically
        const modelConfig = Object.values(SEGMENTATION_MODELS).find(m => m.model_id === modelId);
        const dtype = modelConfig?.default_dtype || 'fp32';

        model = await modelClass.from_pretrained(modelId, {
          device,
          dtype,
          progress_callback: report(0.1, 0.45, "Downloading model..."),
          session_options: {
            executionProviders: [{
              name: 'webgpu',
              deviceType: 'gpu',
              forceCpuNodeNames: [
                '/mask_decoder/transformer/layers.0/mlp/lin2/MatMul',
                '/mask_decoder/transformer/layers.0/mlp/lin1/MatMul',
                '/mask_decoder/transformer/layers.1/mlp/lin2/MatMul',
                '/mask_decoder/transformer/layers.1/mlp/lin1/MatMul',
                '/mask_decoder/transformer/layers.2/mlp/lin2/MatMul',
                '/mask_decoder/transformer/layers.2/mlp/lin1/MatMul',
                '/mask_decoder/transformer/layers.0/mlp/proj_out/MatMul',
                '/mask_decoder/transformer/layers.0/mlp/proj_in/MatMul',
                '/mask_decoder/transformer/layers.1/mlp/proj_out/MatMul',
                '/mask_decoder/transformer/layers.1/mlp/proj_in/MatMul',
                '/mask_decoder/transformer/layers.2/mlp/proj_out/MatMul',
                '/mask_decoder/transformer/layers.2/mlp/proj_in/MatMul',
                '/mask_decoder/transformer/layers.0/self_attn/q_proj/MatMul',
                '/mask_decoder/transformer/layers.0/self_attn/k_proj/MatMul',
                '/mask_decoder/transformer/layers.0/self_attn/v_proj/MatMul',
                '/mask_decoder/transformer/layers.0/self_attn/out_proj/MatMul',
                '/mask_decoder/transformer/layers.1/self_attn/q_proj/MatMul',
                '/mask_decoder/transformer/layers.1/self_attn/k_proj/MatMul',
                '/mask_decoder/transformer/layers.1/self_attn/v_proj/MatMul',
                '/mask_decoder/transformer/layers.1/self_attn/out_proj/MatMul'
              ]
            }]
          }
        });

        report(0.45, 0.45, 'Loading processor...')(0);
        processor = await AutoProcessor.from_pretrained(modelId);
        currentModelId = modelId;
        currentDevice = device;
      }

      if (!payload.bitmap) {
        throw new Error('No image bitmap provided.');
      }

      self.postMessage({ type: 'progress', progress: 0.5, message: 'Processing image...' });

      // Convert ImageBitmap to RawImage using global utility
      const rawImage = await bitmapToRawImage(payload.bitmap);

      // Map point coordinates and labels
      const options = {};
      if (payload.points && payload.points.length > 0) {
        // SAM expects point inputs nested as [ [ [x, y], ... ] ] representing [batch, num_points, 2]
        options.input_points = [ payload.points.map(p => [p.x * rawImage.width, p.y * rawImage.height]) ];
        options.input_labels = [ payload.points.map(p => p.label) ];
      }

      self.postMessage({ type: 'progress', progress: 0.6, message: 'Preparing inputs...' });

      // Process inputs (Image + Points -> Tensors) using high-level AutoProcessor API
      inputs = await processor(rawImage, options);

      self.postMessage({ type: 'progress', progress: 0.65, message: 'Running model...' });

      // Run inference directly on WebGPU
      const outputs = await model(inputs);

      self.postMessage({ type: 'progress', progress: 0.8, message: 'Generating mask...' });

      // Post-process outputs back into a usable mask
      const predMasks = outputs.pred_masks || outputs.masks || (Array.isArray(outputs) ? outputs[0] : null);
      if (!predMasks) {
        throw new Error('Inference failed: Model returned no masks.');
      }

      const masks = await processor.post_process_masks(
        predMasks,
        inputs.original_sizes,
        inputs.reshaped_input_sizes
      );

      if (!masks || masks.length === 0) {
        throw new Error('Post-processing failed: Result array is empty.');
      }

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

      payload.bitmap.close();

      self.postMessage({
        type: 'complete',
        result: {
          options: results,
          mode: payload.mode
        }
      }, transferables);

    } catch (error) {
      if (error.message.includes('lost') || error.message.includes('GPUBuffer') || error.message.includes('AbortError')) {
        model = null;
        processor = null;
        currentModelId = null;
      }
      self.postMessage({ type: 'error', error: error.message });
    } finally {
      if (inputs) {
        if (inputs.pixel_values?.dispose) { try { inputs.pixel_values.dispose(); } catch (_) {} }
        if (inputs.input_points?.dispose) { try { inputs.input_points.dispose(); } catch (_) {} }
        if (inputs.input_labels?.dispose) { try { inputs.input_labels.dispose(); } catch (_) {} }
      }
    }
  } else if (type === 'dispose') {
    if (model?.dispose) { try { model.dispose(); } catch (_) {} }
    model = null;
    processor = null;
    currentModelId = null;
    canvasCache.clear();
    self.postMessage({ type: 'disposed' });
  }
};
