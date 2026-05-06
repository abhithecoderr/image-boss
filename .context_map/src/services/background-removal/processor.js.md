**Code Structure**

*Web Worker Initialization*

```js
import Worker from './worker.js?worker';
import { resizeCanvas } from '../../core/canvas-utils.js';

let worker = null;
let lastProgressTime = 0;
const PROGRESS_THROTTLE = 100; // ms

function getWorker() {
  if (!worker) {
    worker = new Worker();
  }
  return worker;
}
```

*process function*

This part downscales the uploaded image as per particular model's input size, and creates a bitmap of the resized canvas, to send to the background web worker

```js
export async function process(sourceCanvas, options = {}, onProgress) {
  return new Promise(async (resolve, reject) => {
    const w = getWorker();

    // Downsize to model-native resolution early to save RAM and transfer time.
    // These sizes should ideally match the target resolution of the models.
    const modelSizes = {
      'modnet': 512,
      'inspyrenet': 768,
      'birefnet': 512,
      'inspyrenet_lite': 384
    };

    const modelId = options.model;
    const targetSize = modelSizes[modelId] || 768;
    const processedCanvas = resizeCanvas(sourceCanvas, targetSize);
    const originalWidth = sourceCanvas.width;
    const originalHeight = sourceCanvas.height;

    // Zero-copy transfer
    const bitmap = await createImageBitmap(processedCanvas);

    const cleanup = () => {
      w.removeEventListener('message', messageHandler);
      w.removeEventListener('error', errorHandler);
      bitmap.close();
    };
```

*Event handlers and postMessage for web worker communication*

```js
const messageHandler = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        const now = Date.now();
        if (now - lastProgressTime > PROGRESS_THROTTLE || progress === 1) {
            onProgress?.(progress, message);
            lastProgressTime = now;
        }
      } else if (type === 'complete') {
        cleanup();
        resolve(applyMaskToCanvas(sourceCanvas, result));
      } else if (type === 'error') {
        cleanup();
        reject(new Error(error));
      }
    };

    const errorHandler = (err) => {
      cleanup();
      reject(new Error(err.message || 'Worker error'));
    };

    w.addEventListener('message', messageHandler);
    w.addEventListener('error', errorHandler);

    w.postMessage({
      type: 'process',
      payload: {
        bitmap,
        originalWidth,
        originalHeight,
        model: modelId,
      }
    }, [bitmap]);
  });
}
```

*applyMasktoCanvas function*

Responsible for taking the final output bitmap from ai web worker and rendering it into the result canvas object



