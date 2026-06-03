/**
 * WorkerRegistry - Global singleton that enforces a "one active AI model at a time" policy.
 */

class WorkerRegistry {
  constructor() {
    this._workers = {}; // serviceId -> Worker instance
    this._activeId = null; // Currently active service id
    this._onDispose = {}; // serviceId -> callback[]
  }

  /**
   * Get or create the worker for a given service.
   * @param {string} serviceId
   * @param {Function} WorkerClass
   * @returns {Worker}
   */
  getWorker(serviceId, WorkerClass) {
    if (!this._workers[serviceId]) {
      this._workers[serviceId] = new WorkerClass();
    }
    return this._workers[serviceId];
  }

  /**
   * Register a callback that is invoked whenever a service is evicted or disposed.
   * Use this in processor modules to reset their ready-state flags.
   *
   * @param {string} serviceId
   * @param {Function} cb
   * @returns {Function}
   */
  onDispose(serviceId, cb) {
    if (!this._onDispose[serviceId]) {
      this._onDispose[serviceId] = [];
    }
    this._onDispose[serviceId].push(cb);

    return () => {
      this._onDispose[serviceId] = (this._onDispose[serviceId] || []).filter(
        (fn) => fn !== cb,
      );
    };
  }

  /**
   * Mark a service as active and softly evict every other loaded worker.
   *
   * @param {string} serviceId
   * @param {string[]} [noDisposeIds=[]]
   */
  activate(serviceId, noDisposeIds = []) {
    if (this._activeId === serviceId) return;

    this._activeId = serviceId;

    for (const id of Object.keys(this._workers)) {
      if (id !== serviceId && !noDisposeIds.includes(id)) {
        this.terminate(id);
      }
    }
  }

  /**
   * Ask a worker to release its loaded model while keeping the worker alive.
   *
   * @param {string} serviceId
   */
  dispose(serviceId) {
    const worker = this._workers[serviceId];
    if (worker) {
      try {
        worker.postMessage({ type: "dispose" });
      } catch (_) {
        // Worker may have been terminated or not yet started.
      }
    }

    const callbacks = this._onDispose[serviceId];
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb();
        } catch (_) {}
      }
    }
  }

  /**
   * Terminate and remove a worker from the registry.
   *
   * @param {string} serviceId
   */
  terminate(serviceId) {
    const worker = this._workers[serviceId];
    if (worker) {
      try {
        worker.terminate();
      } catch (_) {}
      delete this._workers[serviceId];
      if (this._activeId === serviceId) {
        this._activeId = null;
      }
    }

    const callbacks = this._onDispose[serviceId];
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb();
        } catch (_) {}
      }
    }
  }
}

export const workerRegistry = new WorkerRegistry();
