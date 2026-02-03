import Worker from './worker.js?worker';

// Singleton state
let worker = null;
const callbacks = {
  onProgress: null,
  onToken: null,
  resolve: null,
  reject: null
};

/**
 * Get the worker instance with a PERMANENT message listener.
 * This prevents "dropped messages" when switching between load and generate.
 */
function getWorker() {
  if (!worker) {
    worker = new Worker();

    // Attach the listener ONCE. It never gets replaced.
    worker.onmessage = ({ data }) => {
      const { type, token, output, error, progress, message } = data;

      switch (type) {
        case 'progress':
          callbacks.onProgress?.(progress, message);
          break;

        case 'loaded':
          callbacks.resolve?.();
          break;

        case 'token':
          // This routes the token to your UI callback immediately
          console.log('[Processor] Received token:', token);
          callbacks.onToken?.(token);
          break;

        case 'complete':
          callbacks.resolve?.(output);
          break;

        case 'error':
          callbacks.reject?.(new Error(error));
          break;
      }
    };
  }
  return worker;
}

export function load(options = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    // Register the callbacks for this operation
    callbacks.resolve = resolve;
    callbacks.reject = reject;
    callbacks.onProgress = onProgress;

    w.postMessage({ type: 'load', payload: options });
  });
}

export function generate(prompt, onToken, options = {}) {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    // Register the callbacks for this operation
    callbacks.onToken = onToken;
    callbacks.resolve = resolve;
    callbacks.reject = reject;

    // We don't need onProgress for generation usually
    callbacks.onProgress = null;

    w.postMessage({
      type: 'generate',
      payload: { prompt, ...options }
    });
  });
}

export function dispose() {
  if (worker) {
    worker.postMessage({ type: 'dispose' });
  }
}

export default { load, generate, dispose };