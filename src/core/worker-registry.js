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
    this._onDispose = {};     // serviceId → callback[] — notified when a service is evicted
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
   * Register a callback that is invoked on the main thread whenever a service
   * is evicted by activate(). Use this in processor modules to reset their
   * ready-state flags so the next invocation re-initializes the model.
   *
   * @param {string} serviceId - The service to listen for eviction
   * @param {Function} cb - Zero-argument callback
   * @returns {Function} Unsubscribe function
   */
  onDispose(serviceId, cb) {
    if (!this._onDispose[serviceId]) {
      this._onDispose[serviceId] = [];
    }
    this._onDispose[serviceId].push(cb);
    // Return unsubscribe function
    return () => {
      this._onDispose[serviceId] = (this._onDispose[serviceId] || []).filter(f => f !== cb);
    };
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

    this._activeId = serviceId;

    // Evict every other loaded worker's model
    for (const [id, worker] of Object.entries(this._workers)) {
      if (id !== serviceId && !noDisposeIds.includes(id)) {
        try {
          worker.postMessage({ type: 'dispose' });
        } catch (_) {
          // Worker may have been terminated or not yet started — safe to ignore
        }

        // Notify main-thread processor callbacks so they can reset their ready state
        const callbacks = this._onDispose[id];
        if (callbacks) {
          for (const cb of callbacks) {
            try { cb(); } catch (_) {}
          }
        }
      }
    }
  }

  /**
   * Terminate and remove a worker from the registry.
   * Useful if the worker has crashed or is in a bad state.
   */
  terminate(serviceId) {
    const w = this._workers[serviceId];
    if (w) {
      try {
        w.terminate();
      } catch (_) {}
      delete this._workers[serviceId];
      if (this._activeId === serviceId) this._activeId = null;
    }

    // Also fire dispose callbacks so processor state is reset
    const callbacks = this._onDispose[serviceId];
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(); } catch (_) {}
      }
    }
  }
}

// Singleton — shared across all processor modules
export const workerRegistry = new WorkerRegistry();
