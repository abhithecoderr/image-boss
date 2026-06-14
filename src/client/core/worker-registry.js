/**
 * WorkerRegistry - Global singleton that enforces a "one active AI model at a time" policy.
 */

// How long to wait for a worker to ack `dispose` before hard-terminating it.
// Long enough for ORT session.release() + WebGPU buffer teardown, short enough
// that a wedged worker doesn't stall a service switch.
const DISPOSE_TIMEOUT_MS = 1500;

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
   * Each eviction is awaited so the previous worker gets a chance to release
   * its ONNX/WebGPU session before being hard-terminated.
   *
   * @param {string} serviceId
   * @param {string[]} [noDisposeIds=[]]
   */
  async activate(serviceId, noDisposeIds = []) {
    if (this._activeId === serviceId) return;

    this._activeId = serviceId;

    const evictions = [];
    for (const id of Object.keys(this._workers)) {
      if (id !== serviceId && !noDisposeIds.includes(id)) {
        evictions.push(this.terminate(id));
      }
    }
    await Promise.all(evictions);
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
   * Gracefully shut down a worker: ask it to release its model/session
   * first, then hard-terminate once it acks (or after a short timeout).
   *
   * Workers only release ONNX/WebGPU sessions inside their `dispose`
   * message handler — a hard `terminate()` without that message leaks
   * device-allocated buffers until the thread dies.
   *
   * @param {string} serviceId
   * @returns {Promise<void>} resolves once the worker is gone.
   */
  async terminate(serviceId) {
    const worker = this._workers[serviceId];
    if (worker) {
      // Wait for a `disposed` ack with a timeout fallback to hard-kill.
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, DISPOSE_TIMEOUT_MS);
        const onAck = (e) => {
          if (e?.data?.type === 'disposed' || e?.data?.type === 'complete') {
            clearTimeout(timeout);
            worker.removeEventListener('message', onAck);
            resolve();
          }
        };
        worker.addEventListener('message', onAck);
        try {
          worker.postMessage({ type: 'dispose' });
        } catch (_) {
          // Worker may already be dead — fall through to terminate().
          clearTimeout(timeout);
          worker.removeEventListener('message', onAck);
          resolve();
        }
      });

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

  /**
   * Synchronous termination kept only for true emergencies (e.g. a worker
   * that is unresponsive). Prefer `terminate()` which disposes first.
   *
   * @param {string} serviceId
   */
  terminateNow(serviceId) {
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
