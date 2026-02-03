/**
 * Captioning Worker
 * Runs ViT-GPT2 model in a separate thread
 */

import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

let captioner = null;

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === 'process') {
    try {
      // Initialize model if needed
      if (!captioner) {
        self.postMessage({ type: 'progress', progress: 0.1, message: 'Loading ViT-GPT2 model...' });

        captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning', {
          device: 'webgpu',
          dtype: 'q8',
          progress_callback: (p) => {
            if (p.status === 'progress' && p.progress) {
              self.postMessage({
                type: 'progress',
                progress: 0.1 + p.progress * 0.4,
                message: `Downloading model... ${Math.round(p.progress)}%`
              });
            }
          },
        });
      }

      self.postMessage({ type: 'progress', progress: 0.5, message: 'Generating caption...' });

      // Run captioning
      const output = await captioner(payload.imageData, {
        max_new_tokens: 50,
        temperature: 0.7,
      });

      const caption = output[0]?.generated_text || 'Unable to generate caption';

      self.postMessage({
        type: 'complete',
        result: { caption }
      });

    } catch (error) {
      self.postMessage({ type: 'error', error: error.message });
    }
  }
};
