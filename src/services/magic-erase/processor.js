import { createProgressReporter } from '../../core/worker-utils.js';
import MagicEraseWorker from './worker.js?worker';

export default {
    id: 'magic-erase',
    worker: null,
    workerInitPromise: null,
  
    async initWorker(progressCallback) {
      if (this.worker) return this.worker;
  
      if (this.workerInitPromise) {
          return this.workerInitPromise;
      }
  
      this.workerInitPromise = new Promise((resolve, reject) => {
        const worker = new MagicEraseWorker();
        
        worker.onmessage = (e) => {
          const { type, payload, info, error } = e.data;
          
          if (type === 'init-status') {
             progressCallback(0, payload?.message || 'Loading Magic Erase...');
          } else if (type === 'ready') {
            resolve(worker);
          } else if (type === 'error') {
            // Clear the promise so the next call to initWorker retries instead of
            // returning the same rejected promise indefinitely.
            this.workerInitPromise = null;
            reject(new Error(error));
          }
        };
  
        worker.onerror = (e) => {
          this.workerInitPromise = null;
          reject(new Error(e.message));
        };
  
        worker.postMessage({
          type: 'init',
          payload: { modelURL: 'https://huggingface.co/TheGuy444/LaMa-Web/resolve/main/onnx/lama.onnx' }
        });
      });
  
      this.worker = await this.workerInitPromise;
      return this.worker;
    },
  
    async process(originalCanvas, options, onProgress) {
      const report = createProgressReporter(onProgress);
      const worker = await this.initWorker(onProgress);
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
      
      // Store original arrays
      const originalData = new Uint8ClampedArray(imageData.data);
      const maskData = new Uint8ClampedArray(maskImageData.data);
  
      report(0.3, 0.3, 'Running AI Inference...')();
      
      return new Promise((resolve, reject) => {
          const messageHandler = (e) => {
              const { type, output, error } = e.data;
              
              if (type === 'complete') {
                  worker.removeEventListener('message', messageHandler);
                  report(0.8, 0.8, 'Compositing result...')();
                  
                  // Compute standard optimization constants and scale ranges
                  const finalImageData = new ImageData(512, 512);
                  let min = Infinity, max = -Infinity;
                  const ch2 = 262144;
                  const ch3 = 524288;
                  const strength = typeof options.strength === 'number' ? options.strength : 1.0;

                  // Iterate ALL values for accurate min/max — sampling every 100th value
                  // is not statistically reliable and can cause wrong scale mode selection.
                  for (let i = 0; i < output.length; i++) {
                      if (output[i] < min) min = output[i];
                      if (output[i] > max) max = output[i];
                  }
                  
                  const range = max - min;
                  let scaleMode = 0;
                  if (min >= -1.05 && max <= 1.05) {
                      scaleMode = min < -0.1 ? 1 : 2;
                  } else if (min >= 0 && max <= 255.5) {
                      scaleMode = 3;
                  } else if (range > 0) {
                      scaleMode = 4;
                  }
                  
                  for (let i = 0; i < ch2; i++) {
                      const pi = i * 4;
                      const maskActive = maskData[pi] > 128; // Extracted white stroke
                      
                      if (maskActive) {
                          let r, g, b;
                          if (scaleMode === 1) {
                              r = (output[i] + 1.0) * 127.5;
                              g = (output[i + ch2] + 1.0) * 127.5;
                              b = (output[i + ch3] + 1.0) * 127.5;
                          } else if (scaleMode === 2) {
                              r = output[i] * 255;
                              g = output[i + ch2] * 255;
                              b = output[i + ch3] * 255;
                          } else if (scaleMode === 3) {
                              r = output[i];
                              g = output[i + ch2];
                              b = output[i + ch3];
                          } else {
                              r = ((output[i] - min) / (range || 1)) * 255;
                              g = ((output[i + ch2] - min) / (range || 1)) * 255;
                              b = ((output[i + ch3] - min) / (range || 1)) * 255;
                          }
                          
                          // Interpolate Original and Inpaint using 'strength'
                          finalImageData.data[pi] = originalData[pi] * (1 - strength) + r * strength;
                          finalImageData.data[pi + 1] = originalData[pi + 1] * (1 - strength) + g * strength;
                          finalImageData.data[pi + 2] = originalData[pi + 2] * (1 - strength) + b * strength;
                      } else {
                          finalImageData.data[pi] = originalData[pi];
                          finalImageData.data[pi + 1] = originalData[pi + 1];
                          finalImageData.data[pi + 2] = originalData[pi + 2];
                      }
                      finalImageData.data[pi + 3] = 255;
                  }
                  
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
  
          // Send ImageData arrays as plain (non-transferred) copies since
          // the compositing loop on this side still needs originalData/maskData.
          // The worker receives structured clones — acceptable for 512x512 (~1MB each).
          worker.postMessage({
              type: 'inpaint',
              payload: {
                  image: imageData.data,
                  mask: maskImageData.data
              }
          });
      });
    },
  
    dispose() {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
        this.workerInitPromise = null;
      }
    }
  };
