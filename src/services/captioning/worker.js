/**
 * Captioning Worker
 * Runs ViT-GPT2 model in a separate thread
 */

import {
  Florence2ForConditionalGeneration,
  AutoProcessor,
  RawImage,
  env
} from '@huggingface/transformers';

// Hardware acceleration configuration
env.allowLocalModels = false;
// Note: Some environments may have issues with proxying in workers
env.backends.onnx.wasm.proxy = false;

let model = null;
let processor = null;

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

  if (type === 'process') {
    try {
      const { bitmap, task = '<MORE_DETAILED_CAPTION>', modelId } = payload;

      // 1. Initialize Florence-2
      if (!model) {
        self.postMessage({ type: 'progress', progress: 0.1, message: 'Initializing Florence-2 Processor...' });
        processor = await AutoProcessor.from_pretrained(modelId);

        self.postMessage({ type: 'progress', progress: 0.2, message: 'Loading Florence-2 Model (fp16)...' });
        try {
          model = await Florence2ForConditionalGeneration.from_pretrained(modelId, {
            dtype: 'fp16',
            device: 'webgpu'
          });
          self.postMessage({ type: 'progress', progress: 0.5, message: 'fp16 model loaded' });
        } catch (fp16Error) {
          console.warn('[Worker] fp16 failed, falling back to fp32:', fp16Error);
          self.postMessage({ type: 'progress', progress: 0.3, message: 'fp16 failed, trying fp32...' });

          model = await Florence2ForConditionalGeneration.from_pretrained(modelId, {
            dtype: 'fp32',
            device: 'webgpu'
          });
          self.postMessage({ type: 'progress', progress: 0.5, message: 'fp32 model loaded' });
        }
      }

      self.postMessage({ type: 'progress', progress: 0.6, message: 'Processing vision inputs...' });

      // 2. Prepare Inputs
      let image;
      try {
        const canvas = bitmapToCanvas(bitmap);
        image = await RawImage.fromCanvas(canvas);
      } catch (imgErr) {
        throw new Error(`Failed to convert image to RawImage: ${imgErr.message || imgErr}`);
      }

      const prompts = processor.construct_prompts(task);
      const inputs = await processor(image, prompts);

      self.postMessage({ type: 'progress', progress: 0.8, message: 'Generating description...' });

      // 3. Generate
      const generated_ids = await model.generate({
        ...inputs,
        max_new_tokens: 100,
      });

      // 4. Decode & Post-process
      const generated_text = processor.batch_decode(generated_ids, { skip_special_tokens: false })[0];
      const result = processor.post_process_generation(generated_text, task, image.size);

      // Extract the caption from the structured result
      const caption = result[task] || generated_text;

      self.postMessage({
        type: 'complete',
        result: { caption, raw: result }
      });

      // Cleanup
      bitmap.close();

    } catch (error) {
      console.error('[Worker] Florence-2 Critical Error:', error);
      const errMsg = error.message || error;

      // Attempt to decode numeric error pointers if they occur
      const finalMsg = (typeof errMsg === 'number' || /^\d+$/.test(errMsg))
        ? `Hardware/Memory Error (Code: ${errMsg}). Possibly OOM or WebGPU incompatibility.`
        : errMsg;

      self.postMessage({ type: 'error', error: finalMsg });
    }
  }
};
