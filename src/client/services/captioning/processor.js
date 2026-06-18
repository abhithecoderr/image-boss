import Worker from './worker.js?worker';
import { workerRegistry } from '../../engine/worker-registry.js';
import { CAPTIONING_MODELS, PAID_MODELS_CONFIG } from '../../config/models.js';
import { runWorkerJob } from '../../utils/worker-utils.js';
import { createCaptionOverlay } from './helpers.js';
import { captionImage } from '../../api/caption.js';

const SERVICE_ID = 'captioning';

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, Worker);
}

/**
 * Generate caption or segmentation for image
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const tier = options.tier || 'free';

  if (tier === 'paid') {
    const modelId = 'lfm2.5-vl';
    const paidModelCfg = PAID_MODELS_CONFIG[modelId];
    const apiModelTag = paidModelCfg ? paidModelCfg.api_model_tag : modelId;
    const apiDevice = paidModelCfg ? paidModelCfg.api_runtime : 'cpu';

    onProgress?.(0.1, 'Converting image to payload...');
    const imageBlob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, 'image/png'));

    onProgress?.(0.3, `Uploading to Cloud API (${apiModelTag})...`);
    try {
      const caption = await captionImage('/api', imageBlob, {
        model: apiModelTag,
        device: apiDevice,
        prompt: options.lfmPrompt || 'Describe this image in detail.'
      });

      onProgress?.(0.95, 'Rendering result...');
      const resultCanvas = createCaptionOverlay(sourceCanvas, caption);

      onProgress?.(1, 'Complete!');
      return { canvas: resultCanvas, captioning: caption };
    } catch (err) {
      console.error(`[Captioning Paid] Processing failed:`, err);
      throw err;
    }
  }

  const w = getWorker();

  // Use zero-copy ImageBitmap transfer
  const bitmap = await createImageBitmap(sourceCanvas);

  try {
    const result = await runWorkerJob(
      w,
      'process',
      {
        bitmap,
        modelId: options.modelId || CAPTIONING_MODELS.lfm.model_id,
        lfmPrompt: options.lfmPrompt || 'Describe this image in detail.'
      },
      [bitmap],
      onProgress
    );

    onProgress?.(0.95, 'Rendering result...');
    const resultCanvas = createCaptionOverlay(sourceCanvas, result.value);
    const finalValue = result.value;

    onProgress?.(1, 'Complete!');
    return { canvas: resultCanvas, captioning: finalValue };
  } finally {
    bitmap.close();
  }
}



/**
 * Dispose worker and free resources
 */
export async function dispose() {
  workerRegistry.dispose(SERVICE_ID);
}

export default { process, dispose };
