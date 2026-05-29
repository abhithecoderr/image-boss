import { createProgressReporter } from '../../core/worker-utils.js';
import { MAGIC_ERASE_MODELS } from '../config/models.js';
import MagicEraseWorker from './worker.js?worker';
import { workerRegistry } from '../../core/worker-registry.js';

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

  // Get the mask from the overlay canvas in the DOM
  const maskCanvas = document.getElementById('magic-erase-mask');
  if (!maskCanvas) {
      throw new Error("Mask canvas not found. Please brush an area to erase.");
  }
  
  const imgW = originalCanvas.width;
  const imgH = originalCanvas.height;
  const aspect = imgW / imgH;

  let targetW, targetH, padX, padY;
  if (aspect > 1) { // Landscape
      targetW = 512;
      targetH = Math.round(512 / aspect);
      padX = 0;
      padY = Math.floor((512 - targetH) / 2);
  } else { // Portrait
      targetH = 512;
      targetW = Math.round(512 * aspect);
      padY = 0;
      padX = Math.floor((512 - targetW) / 2);
  }

  // Setup the 512x512 inputs
  const inputTempCanvas = new OffscreenCanvas(512, 512);
  const inputCtx = inputTempCanvas.getContext('2d');
  inputCtx.clearRect(0, 0, 512, 512);
  inputCtx.drawImage(originalCanvas, padX, padY, targetW, targetH);
  
  const maskTempCanvas = new OffscreenCanvas(512, 512);
  const maskCtx = maskTempCanvas.getContext('2d');
  maskCtx.fillStyle = 'black';
  maskCtx.fillRect(0, 0, 512, 512);
  // Ensure the mask isn't translucent when extracted from the overlay which might have opacity assigned via CSS
  maskCtx.globalAlpha = 1.0;
  maskCtx.drawImage(maskCanvas, padX, padY, targetW, targetH);

  const imageData = inputCtx.getImageData(0, 0, 512, 512);
  const maskImageData = maskCtx.getImageData(0, 0, 512, 512);
  
  report(0.3, 0.3, 'Running AI Inference...')();
  
  return new Promise((resolve, reject) => {
      const messageHandler = (e) => {
          const { type, output, error } = e.data;
          
          if (type === 'complete') {
              worker.removeEventListener('message', messageHandler);
              report(0.8, 0.8, 'Compositing result...')();
              
              const finalImageData = new ImageData(output, 512, 512);
              
              // Restore onto final output canvas, translating backwards from 512 to native Aspect Ratio pad
              const outTempCanvas = new OffscreenCanvas(512, 512);
              const outTempCtx = outTempCanvas.getContext('2d');
              outTempCtx.putImageData(finalImageData, 0, 0);
              
              const finalOutCanvas = document.createElement('canvas');
              finalOutCanvas.width = imgW;
              finalOutCanvas.height = imgH;
              const finalCtx = finalOutCanvas.getContext('2d');
              
              // Map inverse
              finalCtx.drawImage(outTempCanvas, padX, padY, targetW, targetH, 0, 0, imgW, imgH);
              
              report(1, 1, 'Complete')();
              resolve(finalOutCanvas);

          } else if (type === 'error') {
              worker.removeEventListener('message', messageHandler);
              reject(new Error(error));
          }
      };
      
      worker.addEventListener('message', messageHandler);

      // Send ImageData arrays as transferable zero-copy buffers.
      worker.postMessage({
          type: 'inpaint',
          payload: {
              image: imageData.data,
              mask: maskImageData.data,
              options: { strength: typeof options.strength === 'number' ? options.strength : 1.0 }
          }
      }, [imageData.data.buffer, maskImageData.data.buffer]);
  });
}

function dispose() {
  workerRegistry.terminate(SERVICE_ID);
  // _worker and _workerInitPromise are cleared by the onDispose callback above
}

export default { id: SERVICE_ID, process, dispose };
