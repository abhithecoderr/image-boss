/**
 * Captioning Worker (Transformers.js v4)
 * Supports Florence-2 and LFM 2.5 VL model architectures
 */

import {
  Florence2ForConditionalGeneration,
  AutoModelForImageTextToText,
  AutoProcessor,
  RawImage,
  env
} from '@huggingface/transformers';

// v4: no wasm.proxy workaround needed — build system no longer double-proxies
env.allowLocalModels = false;

let model = null;
let processor = null;
let currentModelId = null;  // Track loaded model to detect switches

/**
 * Detect WebGPU and fp16 support
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
 * Determine model architecture from its ID
 */
function getModelArch(modelId) {
  if (modelId.includes('LFM')) return 'lfm';
  return 'florence2';
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

/**
 * Standard progress callback factory for model downloads
 */
function makeProgressCallback(baseProgress, range) {
  return (p) => {
    if (p.status === 'progress') {
      const pct = p.total
        ? ((p.loaded ?? 0) / p.total) * 100
        : (p.progress ?? 0);
      if (pct > 0) {
        self.postMessage({
          type: 'progress',
          progress: baseProgress + (pct / 100) * range,
          message: `Downloading model... ${Math.round(pct)}%`
        });
      }
    }
  };
}

// ─── Florence-2 Pipeline ────────────────────────────────────────────────────

async function loadFlorence2(modelId, hw) {
  self.postMessage({ type: 'progress', progress: 0.1, message: 'Initializing Florence-2 Processor...' });
  processor = await AutoProcessor.from_pretrained(modelId);

  // v4: promote to fp16 where hardware supports it — ~2× faster generation
  // with the new C++ WebGPU runtime. Fall back to fp32 if fp16 unavailable.
  const device = hw.supported ? 'webgpu' : 'wasm';
  const dtype = (hw.supported && hw.fp16) ? 'fp16' : 'fp32';

  self.postMessage({ type: 'progress', progress: 0.2, message: `Loading Florence-2 Model (${dtype})...` });

  model = await Florence2ForConditionalGeneration.from_pretrained(modelId, {
    dtype,
    device,
    progress_callback: makeProgressCallback(0.2, 0.3),
  });

  currentModelId = modelId;
  self.postMessage({ type: 'progress', progress: 0.5, message: `Model loaded (${dtype}, ${device})` });
}

async function runFlorence2(image, task, segPrompt) {
  // Handle full prompt for segmentation.
  // Ensure exactly one space between task and prompt — standard Florence-2 requirement.
  // NOTE: This is a model behavioural invariant, not a library version issue. Keep in v4.
  const cleanedSegPrompt = segPrompt.trim();
  const fullPrompt = task === '<REFERRING_EXPRESSION_SEGMENTATION>'
    ? `${task} ${cleanedSegPrompt}`
    : task;

  const prompts = processor.construct_prompts(fullPrompt);
  const inputs = await processor(image, prompts);

  self.postMessage({ type: 'progress', progress: 0.8, message: 'Generating description...' });

  const generated_ids = await model.generate({
    ...inputs,
    max_new_tokens: task === '<REFERRING_EXPRESSION_SEGMENTATION>' ? 1024 : 100,
  });

  // 4. Decode & Post-process
  const generated_text = processor.batch_decode(generated_ids, { skip_special_tokens: false })[0];

  // SANITIZATION: Some Florence-2 versions output <loc_XXX> but Transformers.js expects <locXXX>
  // This is a model-level artefact — kept in v4.
  const sanitizedGeneratedText = generated_text.replace(/<loc_/g, '<loc');

  const result = processor.post_process_generation(sanitizedGeneratedText, fullPrompt, image.size);

  // Extract the result (caption or polygons)
  let value = result[fullPrompt] || result[task] || generated_text;

  // Ensure we pass the object if polygons are present, even if found under task key
  if (typeof value === 'string' && result[task]?.polygons) {
    value = result[task];
  }

  return { value, raw: result };
}

// ─── LFM 2.5 VL Pipeline ───────────────────────────────────────────────────

async function loadLFM(modelId, hw) {
  self.postMessage({ type: 'progress', progress: 0.1, message: 'Initializing LFM 2.5 VL Processor...' });
  processor = await AutoProcessor.from_pretrained(modelId);

  const device = hw.supported ? 'webgpu' : 'wasm';

  // LFM uses per-component dtype for optimal performance
  const dtype = hw.supported ? {
    vision_encoder: 'fp16',
    embed_tokens: 'fp16',
    decoder_model_merged: 'q4',
  } : 'fp32';

  const dtypeLabel = hw.supported ? 'fp16+q4' : 'fp32';
  self.postMessage({ type: 'progress', progress: 0.2, message: `Loading LFM 2.5 VL Model (${dtypeLabel})...` });

  model = await AutoModelForImageTextToText.from_pretrained(modelId, {
    device,
    dtype,
    progress_callback: makeProgressCallback(0.2, 0.3),
  });

  currentModelId = modelId;
  self.postMessage({ type: 'progress', progress: 0.5, message: `Model loaded (${dtypeLabel}, ${device})` });
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

  if (type === 'process') {
    try {
      const {
        bitmap,
        task = '<MORE_DETAILED_CAPTION>',
        segPrompt = '',
        modelId,
        lfmPrompt = ''
      } = payload;

      const arch = getModelArch(modelId);

      // 1. (Re)initialize model if needed
      if (!model || modelId !== currentModelId) {
        // Switching models — tear down the old one first
        if (currentModelId && modelId !== currentModelId) {
          self.postMessage({ type: 'progress', progress: 0.05, message: 'Switching model...' });
          await teardown();
        }

        const hw = await getGPUConfig();

        if (arch === 'lfm') {
          await loadLFM(modelId, hw);
        } else {
          await loadFlorence2(modelId, hw);
        }
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
      let result;
      if (arch === 'lfm') {
        result = await runLFM(image, lfmPrompt);
      } else {
        result = await runFlorence2(image, task, segPrompt);
      }

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
