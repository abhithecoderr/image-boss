/**
 * WorkerRegistry — Global singleton that enforces a "one active AI model at a time" policy.
 *
 * When a service is activated, any previously active service worker receives
 * a 'dispose' message, which tells it to release its model from GPU/CPU memory.
 * The model's weights remain in the browser's HTTP cache, so re-loading is
 * fast (seconds, not minutes) when the user returns to that service.
 */

class WorkerRegistry {
  constructor() {
    this._workers = {};       // serviceId → Worker instance
    this._activeId = null;    // Currently active service id
  }

  /**
   * Get or create the worker for a given service.
   * @param {string} serviceId  - Unique service id (e.g. 'background-removal')
   * @param {Function} WorkerClass - The Vite ?worker class for that service
   * @returns {Worker}
   */
  getWorker(serviceId, WorkerClass) {
    if (!this._workers[serviceId]) {
      this._workers[serviceId] = new WorkerClass();
    }
    return this._workers[serviceId];
  }

  /**
   * Mark a service as active. All other AI-backed service workers receive
   * a 'dispose' message so they can free their model from memory.
   *
   * @param {string} serviceId - The service that is now active
   * @param {string[]} [noDisposeIds=[]] - Service ids to skip eviction (e.g. magic-erase whose model is small)
   */
  activate(serviceId, noDisposeIds = []) {
    if (this._activeId === serviceId) return; // Already active, nothing to do

    const prev = this._activeId;
    this._activeId = serviceId;

    // Evict every other loaded worker's model
    for (const [id, worker] of Object.entries(this._workers)) {
      if (id !== serviceId && !noDisposeIds.includes(id)) {
        try {
          worker.postMessage({ type: 'dispose' });
          console.info(`[WorkerRegistry] Sent dispose to '${id}' (switching to '${serviceId}')`);
        } catch (_) {
          // Worker may have been terminated or not yet started — safe to ignore
        }
      }
    }
  }

  /**
   * Terminate a specific worker entirely (full cleanup).
   * Use this only when you want to free the worker thread itself, not just the model.
   */
  terminate(serviceId) {
    const w = this._workers[serviceId];
    if (w) {
      w.terminate();
      delete this._workers[serviceId];
      if (this._activeId === serviceId) this._activeId = null;
    }
  }
}

// Singleton — shared across all processor modules
export const workerRegistry = new WorkerRegistry();
