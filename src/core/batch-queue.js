/**
 * BatchQueue — Pure JS batch processing engine
 * Framework-agnostic: no React, no state management.
 * Manages a list of batch items with ordering, selection, and download tracking.
 */

import { loadImage, imageToCanvas } from './canvas-utils.js';

let _nextId = 0;
function uid() {
  return `batch_${Date.now()}_${_nextId++}`;
}

/**
 * @typedef {Object} BatchItem
 * @property {string} id
 * @property {File} file
 * @property {string} name
 * @property {HTMLCanvasElement|null} sourceCanvas
 * @property {HTMLCanvasElement|OffscreenCanvas|ImageBitmap|null} resultCanvas
 * @property {'pending'|'processing'|'done'|'error'} status
 * @property {string|null} error
 * @property {Object} stepResults - Results per step, keyed by step ID. e.g. { step_1: { resultCanvas, resultText, status, error } }
 */

export class BatchQueue {
  /** @type {BatchItem[]} */
  items = [];
  /** @type {Set<string>} */
  selectedIds = new Set();
  /** @type {Set<string>} */
  downloadedIds = new Set();

  /**
   * Add files to the queue. Returns array of newly created items.
   * Source canvases are created asynchronously — caller should await.
   * @param {FileList|File[]} files
   * @returns {Promise<BatchItem[]>}
   */
  async addFiles(files) {
    const newItems = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;

      const id = uid();
      const item = {
        id,
        file,
        name: file.name,
        sourceCanvas: null,
        resultCanvas: null,
        stepResults: {},
        status: 'pending',
        error: null,
      };

      try {
        const img = await loadImage(file);
        item.sourceCanvas = imageToCanvas(img).canvas;
      } catch (err) {
        item.status = 'error';
        item.error = 'Failed to load image';
      }

      this.items.push(item);
      newItems.push(item);
    }
    return newItems;
  }

  /**
   * Remove an item by id
   */
  removeItem(id) {
    this.items = this.items.filter(item => item.id !== id);
    this.selectedIds.delete(id);
    this.downloadedIds.delete(id);
  }

  /**
   * Reorder: move item from one index to another
   */
  reorder(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (fromIdx < 0 || toIdx < 0) return;
    if (fromIdx >= this.items.length || toIdx >= this.items.length) return;

    const [moved] = this.items.splice(fromIdx, 1);
    this.items.splice(toIdx, 0, moved);
  }

  /**
   * Toggle multi-select for download
   */
  toggleSelect(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  selectAll() {
    this.items.forEach(item => this.selectedIds.add(item.id));
  }

  deselectAll() {
    this.selectedIds.clear();
  }

  /**
   * Get item by id
   * @returns {BatchItem|undefined}
   */
  getItem(id) {
    return this.items.find(item => item.id === id);
  }

  /**
   * Set result canvas for an item
   */
  setResult(id, resultCanvas) {
    const item = this.getItem(id);
    if (item) {
      item.resultCanvas = resultCanvas;
      item.status = 'done';
    }
  }

  /**
   * Set result for a specific workflow step
   */
  setStepResult(id, stepId, resultObj) {
    const item = this.getItem(id);
    if (item) {
      if (!item.stepResults) item.stepResults = {};
      item.stepResults[stepId] = {
        ...item.stepResults[stepId],
        ...resultObj
      };
    }
  }

  /**
   * Clear intermediate step results for an item to free memory.
   * Keeps the final resultCanvas.
   */
  clearStepResults(id) {
    const item = this.getItem(id);
    if (item && item.stepResults) {
      Object.values(item.stepResults).forEach(res => {
        if (res.resultCanvas && res.resultCanvas !== item.resultCanvas && res.resultCanvas !== item.sourceCanvas) {
          // If it's an ImageBitmap, close it. HTMLCanvasElement will be GC'd.
          if (res.resultCanvas.close) res.resultCanvas.close();
        }
      });
      item.stepResults = {};
    }
  }

  /**
   * Get the latest valid canvas for an item, optionally up to a specific step
   */
  getLatestCanvas(id, steps = [], stopBeforeStepId = null) {
      const item = this.getItem(id);
      if (!item) return null;
      if (!item.stepResults || Object.keys(item.stepResults).length === 0) return item.sourceCanvas;

      let latestCanvas = item.sourceCanvas;
      for (const step of steps) {
          if (stopBeforeStepId && step.id === stopBeforeStepId) break;
          const stepRes = item.stepResults[step.id];
          if (stepRes && stepRes.resultCanvas) {
              latestCanvas = stepRes.resultCanvas;
          }
      }
      return latestCanvas;
  }

  /**
   * Set item status
   */
  setStatus(id, status, error = null) {
    const item = this.getItem(id);
    if (item) {
      item.status = status;
      item.error = error;
    }
  }

  /**
   * Get completed results for selected items
   * @returns {BatchItem[]}
   */
  getSelectedResults() {
    return this.items.filter(
      item => this.selectedIds.has(item.id) && item.status === 'done' && item.resultCanvas
    );
  }

  /**
   * Get all completed results that haven't been downloaded yet
   * @returns {BatchItem[]}
   */
  getUndownloadedResults() {
    return this.items.filter(
      item => item.status === 'done' && item.resultCanvas && !this.downloadedIds.has(item.id)
    );
  }

  /**
   * Mark items as downloaded to prevent repeat downloads
   * @param {string[]} ids
   */
  markDownloaded(ids) {
    ids.forEach(id => this.downloadedIds.add(id));
  }

  /**
   * Get count of completed results
   */
  get doneCount() {
    return this.items.filter(item => item.status === 'done').length;
  }

  /**
   * Get count of pending items
   */
  get pendingCount() {
    return this.items.filter(item => item.status === 'pending').length;
  }

  /**
   * Mark all items as pending to allow re-processing with different settings
   */
  resetItemsStatus() {
    this.items.forEach(item => {
      item.status = 'pending';
      item.resultCanvas = null;
      item.stepResults = {};
      item.error = null;
    });
    this.downloadedIds.clear();
  }

  /**
   * Reset everything
   */
  reset() {
    this.items.forEach(item => {
        if (item.sourceCanvas?.close) item.sourceCanvas.close();
        if (item.resultCanvas?.close) item.resultCanvas.close();
        this.clearStepResults(item.id);
        item.sourceCanvas = null;
        item.resultCanvas = null;
    });
    this.items = [];
    this.selectedIds.clear();
    this.downloadedIds.clear();
  }
}
