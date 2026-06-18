/**
 * BatchItem — A standardized wrapper for images within the processing pipeline.
 * It abstracts the source (File, Canvas, etc.) and the result status.
 */

export function createBatchItem({ id, name, file = null, sourceCanvas = null }) {
  return {
    id: id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name || 'untitled',
    file,
    sourceCanvas,
    resultCanvas: null,
    status: 'pending', // pending, processing, done, error
    error: null,
    stepResults: {}, // For workflows
    serviceResults: {}, // Persist final results per service
    downloaded: false,
    thumbnailUrl: null, // For caching pre-generated thumbnails
  };
}

/**
 * Closes any ImageBitmap or OffscreenCanvas to free memory
 */
export function disposeBatchItem(item) {
  if (!item) return;
  if (item.sourceCanvas) {
    const cache = item.sourceCanvas._bgRemovalCache;
    if (cache && cache.maskBitmap) {
      try {
        cache.maskBitmap.close();
      } catch (err) {
        console.warn('[BatchItem] Failed to close cached maskBitmap:', err);
      }
      delete item.sourceCanvas._bgRemovalCache;
    }
    const blurCache = item.sourceCanvas._blurCache;
    if (blurCache && blurCache.lastSourceBitmap) {
      try {
        blurCache.lastSourceBitmap.close();
      } catch (err) {
        console.warn('[BatchItem] Failed to close cached lastSourceBitmap:', err);
      }
      delete item.sourceCanvas._blurCache;
    }
    if (item.sourceCanvas.close) {
      try { item.sourceCanvas.close(); } catch (_) {}
    }
  }
  if (item.resultCanvas?.close) {
    try { item.resultCanvas.close(); } catch (_) {}
  }
  if (item.stepResults) {
    Object.values(item.stepResults).forEach(res => {
      if (res.resultCanvas?.close) {
        try { res.resultCanvas.close(); } catch (_) {}
      }
    });
  }
  if (item.serviceResults) {
    Object.values(item.serviceResults).forEach(res => {
      if (res.resultCanvas?.close) {
        try { res.resultCanvas.close(); } catch (_) {}
      }
    });
  }
}
