/**
 * Captioning Worker (Transformers.js v4)
 * Supports Florence-2 and LFM 2.5 VL model architectures
 */

import {
  AutoModelForImageTextToText,
  AutoProcessor,
  RawImage,
  env
} from '@huggingface/transformers';
import { getGPUConfig, createProgressReporter } from '../../core/worker-utils.js';
import { CAPTIONING_MODELS } from '../config/models.js';


// v4: no wasm.proxy workaround needed — build system no longer double-proxies
env.allowLocalModels = false;

let model = null;
let processor = null;
let currentModelId = null;  // Track loaded model to detect switches



/**
 * Convert ImageBitmap to OffscreenCanvas for RawImage compatibility.
 * Reuse a cached canvas to avoid per-call allocations.
 */
let cachedCanvas = null;
let cachedCtx = null;

function bitmapToCanvas(bitmap) {
  if (!cachedCanvas || cachedCanvas.width !== bitmap.width || cachedCanvas.height !== bitmap.height) {
    cachedCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    cachedCtx = cachedCanvas.getContext('2d');
  }
  cachedCtx.drawImage(bitmap, 0, 0);
  return cachedCanvas;
}


/**
 * Determine model architecture from its ID (Hardcoded to LFM after Florence-2 removal)
 */
function getModelArch(modelId) {
  return 'lfm';
}

/**
 * Release currently loaded model/processor so a new one can be loaded
 */
async function teardown() {
  if (model) {
    try { model.dispose?.(); } catch (_) { /* best-effort */ }
  }
  model = null;
  processor = null;
  currentModelId = null;
}





// ─── LFM 2.5 VL Pipeline ───────────────────────────────────────────────────

async function loadLFM(modelId, hw) {
  const onProgress = (prog, msg) => self.postMessage({ type: 'progress', progress: prog, message: msg });
  const report = createProgressReporter(onProgress);

  report(0.1, 0.1, 'Initializing LFM 2.5 VL Processor...')(0);
  processor = await AutoProcessor.from_pretrained(modelId);

  const device = hw.supported ? 'webgpu' : 'wasm';

  // LFM uses per-component dtype for optimal performance
  const dtype = hw.supported ? CAPTIONING_MODELS.lfm.default_dtype : 'fp32';

  const dtypeLabel = hw.supported ? 'fp16+q4' : 'fp32';


  model = await AutoModelForImageTextToText.from_pretrained(modelId, {
    device,
    dtype,
    progress_callback: report(0.2, 0.5, "Downloading LFM 2.5 VL model..."),
  });

  currentModelId = modelId;
  report(0.5, 0.5, `Model loaded (${dtypeLabel}, ${device})`)(0);
}


async function runLFM(image, userPrompt) {
  const prompt = userPrompt?.trim() || 'Describe this image in detail.';

  const messages = [
    { role: 'user', content: [{ type: 'image' }, { type: 'text', text: prompt }] },
  ];

  const chatPrompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
  const inputs = await processor(image, chatPrompt, { add_special_tokens: false });

  self.postMessage({ type: 'progress', progress: 0.8, message: 'Generating description...' });

  const outputs = await model.generate({
    ...inputs,
    do_sample: false,
    max_new_tokens: 256,
  });

  const inputLength = inputs.input_ids.dims.at(-1);
  const generated = outputs.slice(null, [inputLength, null]);
  const caption = processor.batch_decode(generated, { skip_special_tokens: true })[0];

  return { value: caption, raw: { caption } };
}

// ─── Message Handler ────────────────────────────────────────────────────────

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === 'dispose') {
    await teardown();
    return;
  }

  if (type === 'process') {
    try {
      const {
        bitmap,
        modelId,
        lfmPrompt = ''
      } = payload;

      // 1. (Re)initialize model if needed
      if (!model || modelId !== currentModelId) {
        // Switching models — tear down the old one first
        if (currentModelId && modelId !== currentModelId) {
          self.postMessage({ type: 'progress', progress: 0.05, message: 'Switching model...' });
          await teardown();
        }

        const hw = await getGPUConfig();
        await loadLFM(modelId, hw);
      }

      self.postMessage({ type: 'progress', progress: 0.6, message: 'Processing vision inputs...' });

      // 2. Prepare image
      let image;
      try {
        const canvas = bitmapToCanvas(bitmap);
        image = await RawImage.fromCanvas(canvas);
      } catch (imgErr) {
        throw new Error(`Failed to convert image to RawImage: ${imgErr.message || imgErr}`);
      }

      // 3. Run inference
      const result = await runLFM(image, lfmPrompt);

      self.postMessage({ type: 'complete', result });

      // Cleanup
      bitmap.close();

    } catch (error) {
      console.error('[Worker] Captioning Critical Error:', error);
      const errMsg = error.message || error;

      // Decode numeric error pointers (OOM / WebGPU hardware codes)
      const finalMsg = (typeof errMsg === 'number' || /^\d+$/.test(errMsg))
        ? `Hardware/Memory Error (Code: ${errMsg}). Possibly OOM or WebGPU incompatibility.`
        : errMsg;

      // If fp16 was likely the cause, reset model so next call reloads with fallback
      if (
        finalMsg.includes('precision') ||
        finalMsg.includes('NaN') ||
        finalMsg.includes('lost')
      ) {
        console.warn('[Worker] Resetting model — will reload on next call');
        await teardown();
      }

      self.postMessage({ type: 'error', error: finalMsg });
    }
  }
};
