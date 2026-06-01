import Worker from './worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';
import { CAPTIONING_MODELS } from '../../config/models.js';
import { runWorkerJob } from '../../core/worker-utils.js';
import { createCaptionOverlay } from './helpers.js';

const SERVICE_ID = 'captioning';

function getWorker() {
  return workerRegistry.getWorker(SERVICE_ID, Worker);
}

/**
 * Generate caption or segmentation for image
 */
export async function process(sourceCanvas, options = {}, onProgress) {
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
