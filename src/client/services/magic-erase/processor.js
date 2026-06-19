import { createProgressReporter, runWorkerJob } from '../../utils/worker-utils.js';
import { MAGIC_ERASE_MODELS } from '../../config/models.js';
import { prepareInpaintInputs, composeInpaintOutput } from './helpers.js';
import MagicEraseWorker from './worker.js?worker';
import { workerRegistry } from '../../engine/worker-registry.js';

const SERVICE_ID = 'magic-erase';

// Module-level state (mirrors the object's instance fields for the singleton)
let _worker = null;
let _workerInitPromise = null;

// Reset our ready-state whenever the registry evicts this worker so that
// the next initWorker() call re-initializes the model properly.
workerRegistry.onDispose(SERVICE_ID, () => {
  _worker = null;
  _workerInitPromise = null;
});

async function initWorker(progressCallback) {
  if (_worker) return _worker;

  if (_workerInitPromise) {
    return _workerInitPromise;
  }

  _workerInitPromise = new Promise((resolve, reject) => {
    const worker = workerRegistry.getWorker(SERVICE_ID, MagicEraseWorker);
    
    worker.onmessage = (e) => {
      const { type, payload, info, error } = e.data;
      
      if (type === 'init-status') {
         progressCallback(0, payload?.message || 'Loading Magic Erase...');
      } else if (type === 'ready') {
        resolve(worker);
      } else if (type === 'error') {
        // Clear the promise so the next call to initWorker retries instead of
        // returning the same rejected promise indefinitely.
        _workerInitPromise = null;
        reject(new Error(error));
      }
    };

    worker.onerror = (e) => {
      _workerInitPromise = null;
      reject(new Error(e.message));
    };

    worker.postMessage({
      type: 'init',
      payload: { modelURL: MAGIC_ERASE_MODELS.lama.url }
    });
  });

  _worker = await _workerInitPromise;
  return _worker;
}

async function process(originalCanvas, options, onProgress) {
  const report = createProgressReporter(onProgress);
  const worker = await initWorker(onProgress);
  report(0.1, 0.1, 'Extracting mask...')();

  const maskCanvas = options.maskCanvas;
  if (!maskCanvas) {
      throw new Error("Mask canvas not found. Please brush an area to erase.");
  }

  const { imageData, maskImageData, padParams } = prepareInpaintInputs(originalCanvas, maskCanvas);

  report(0.3, 0.3, 'Running AI Inference...')();

  // Run via the shared worker-job runner (handles progress/complete/error,
  // listener cleanup, transferables) instead of a hand-rolled listener.
  const output = await runWorkerJob(
    worker,
    'inpaint',
    {
      image: imageData.data,
      mask: maskImageData.data,
      options: { strength: typeof options.strength === 'number' ? options.strength : 1.0 },
    },
    [imageData.data.buffer, maskImageData.data.buffer],
    (prog, msg) => report(prog, prog, msg)(),
  );

  report(0.8, 0.8, 'Compositing result...')();
  const finalOutCanvas = composeInpaintOutput(output, padParams, originalCanvas, maskCanvas);
  report(1, 1, 'Complete')();
  return finalOutCanvas;
}

function dispose() {
  workerRegistry.terminate(SERVICE_ID);
  // _worker and _workerInitPromise are cleared by the onDispose callback above
}

export default { id: SERVICE_ID, process, dispose };
