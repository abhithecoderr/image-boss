/**
 * ProcessorEngine — Global singleton for loading and managing service processors.
 * Handles lazy-loading, caching, and explicit disposal of processors.
 */

import { workerRegistry } from './worker-registry';

class ProcessorEngine {
  constructor() {
    this._processors = {}; // serviceId -> Processor module
    this._activeId = null; // Currently active processor id
  }

  /**
   * Load a processor for a given service
   * @param {string} serviceId
   * @returns {Promise<Object>}
   */
  async load(serviceId) {
    if (this._processors[serviceId]) {
      return this._processors[serviceId];
    }

    try {
      const module = await import(`../services/${serviceId}/processor.js`);
      const processor = module.default || module;
      processor.id = serviceId;
      this._processors[serviceId] = processor;
      return processor;
    } catch (err) {
      console.error(`[ProcessorEngine] Failed to load processor for '${serviceId}':`, err);
      throw err;
    }
  }

  /**
   * Mark a service as active and clean up the previous one.
   * Enforces the "one active model/processor" policy.
   * @param {string} serviceId
   */
  async activate(serviceId) {
    if (this._activeId === serviceId && this._processors[serviceId]) {
      return this._processors[serviceId];
    }

    // Dispose the previously active processor before switching the registry.
    if (this._activeId && this._processors[this._activeId]) {
      const prev = this._processors[this._activeId];
      if (prev.dispose) {
        try {
          await prev.dispose();
        } catch (err) {
          console.warn(`[ProcessorEngine] Error disposing processor: ${this._activeId}`, err);
        }
      }
    }

    // The engine is the single owner of activation/eviction policy.
    workerRegistry.activate(serviceId);

    this._activeId = serviceId;
    return this.load(serviceId);
  }

  /**
   * Get the current active processor
   */
  get activeProcessor() {
    return this._activeId ? this._processors[this._activeId] : null;
  }

  /**
   * Perform processing using a specific service (auto-activates)
   */
  async process(serviceId, sourceCanvas, options = {}, onProgress = () => {}) {
    // 1. Activate/Load
    const processor = await this.activate(serviceId);

    // 2. Execute
    try {
      return await processor.process(sourceCanvas, options, onProgress);
    } catch (err) {
      console.error(`[ProcessorEngine] Processing failed for '${serviceId}':`, err);
      throw err;
    }
  }
}

export const processorEngine = new ProcessorEngine();
