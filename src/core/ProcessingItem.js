/**
 * ProcessingItem — A standardized wrapper for images within the processing pipeline.
 * It abstracts the source (File, Canvas, etc.) and the result status.
 */
export class ProcessingItem {
  constructor({ id, name, file = null, sourceCanvas = null }) {
    this.id = id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = name || 'untitled';
    this.file = file;
    this.sourceCanvas = sourceCanvas;
    this.resultCanvas = null;
    this.status = 'pending'; // pending, processing, done, error
    this.error = null;
    this.progress = 0;
    this.stepResults = {}; // For workflows
    this.downloaded = false;
  }

  /**
   * Returns a drawable surface for the item (preferring result over source)
   */
  getDisplayCanvas() {
    return this.resultCanvas || this.sourceCanvas;
  }

  /**
   * Closes any ImageBitmap or OffscreenCanvas to free memory
   */
  dispose() {
    if (this.sourceCanvas?.close) this.sourceCanvas.close();
    if (this.resultCanvas?.close) this.resultCanvas.close();
    Object.values(this.stepResults).forEach(res => {
      if (res.resultCanvas?.close) res.resultCanvas.close();
    });
  }
}
