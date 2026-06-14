import { useWorkspace, useUI } from '../store';
import { createBatchItem, disposeBatchItem } from '../core/BatchItem';
import {
  loadImage,
  imageToCanvas,
  downloadCanvas,
  canvasToThumbURL,
} from '../core/canvas-utils';
import { APP_CONFIG } from '../config/app';

/* 
 useFileUpload:
 Coordinates uploading a new file in single-image editing viewport modes.
 Validates file constraints, generates canvases and thumbnails, and replaces the active workspace item.
 */
export const useFileUpload = () => {
  const {
    setOriginalCanvas,
    setOriginalFile,
    setResultCanvas,
    setItems,
    setActiveItemId
  } = useWorkspace();
  const { showToast } = useUI();

  // Receives a raw File, checks size parameters, draws it onto an image element and canvas, and sets up state queues.
  const handleFile = async (file) => {
    if (file.size > APP_CONFIG.maxFileSize) {
      showToast('File too large. Maximum size is 5MB.', 'error');
      return;
    }

    try {
      // Decode raw file bytes into an HTMLImageElement and render onto canvas buffers
      const img = await loadImage(file);
      const { canvas } = imageToCanvas(img);
      
      // Reset single-service and active canvas viewport states
      setOriginalCanvas(canvas);
      showToast('Loading image details...');
      setOriginalFile(file);
      setResultCanvas(null);

      // Reset and bind the multi-service queue (batch/workflow state lists) to this single loaded file
      const item = createBatchItem({
        name: file.name,
        file: file,
        sourceCanvas: canvas
      });
      item.thumbnailUrl = canvasToThumbURL(canvas);
      setItems([item]);
      setActiveItemId(item.id);

      showToast('Image loaded successfully!', 'success');
    } catch (err) {
      console.error('Failed to load image:', err);
      showToast('Failed to load image', 'error');
    }
  };

  return { handleFile };
};

/* 
 useQueueActions:
 Manages the global batch/workflow items queue (add, remove, select, reorder).
 */
export const useQueueActions = (workspace, showToast) => {
  const {
    items,
    setItems,
    activeItemId,
    setActiveItemId,
    setOriginalCanvas,
    setResultCanvas,
    selectedIds,
    setSelectedIds,
  } = workspace;

  const addFiles = async (files) => {
    // Enforce the batch cap — each item holds a full-res canvas, so unbounded
    // queues balloon RAM. Reject overflow up front before decoding anything.
    const remaining = APP_CONFIG.maxBatchItems - items.length;
    if (remaining <= 0) {
      showToast(`Batch limit reached (${APP_CONFIG.maxBatchItems} images). Remove some to add more.`, "warning");
      return;
    }
    const fileList = Array.from(files);
    const overflow = fileList.length - remaining;
    const acceptedFiles = overflow > 0 ? fileList.slice(0, remaining) : fileList;

    const newItems = [];
    for (const file of acceptedFiles) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > APP_CONFIG.maxFileSize) {
        showToast(`File ${file.name} is too large (max 5MB)`, "warning");
        continue;
      }

      const img = await loadImage(file);
      const { canvas } = imageToCanvas(img);

      const item = createBatchItem({
        name: file.name,
        file,
        sourceCanvas: canvas,
      });
      item.thumbnailUrl = canvasToThumbURL(canvas);
      newItems.push(item);
    }

    setItems((prev) => [...prev, ...newItems]);
    if (!activeItemId && newItems.length > 0) {
      setActiveItemId(newItems[0].id);
      setOriginalCanvas(newItems[0].sourceCanvas);
    }
    if (overflow > 0) {
      showToast(`Added ${newItems.length} image(s); ${overflow} skipped (batch limit ${APP_CONFIG.maxBatchItems}).`, "warning");
    } else {
      showToast(`Added ${newItems.length} image(s)`, "success");
    }
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const itemToDispose = prev.find((item) => item.id === id);
      if (itemToDispose) disposeBatchItem(itemToDispose);
      return prev.filter((item) => item.id !== id);
    });
    if (activeItemId === id) {
      setActiveItemId(null);
      setOriginalCanvas(null);
      setResultCanvas(null);
    }
  };

  const selectItem = (id) => {
    const item = items.find((entry) => entry.id === id);
    if (item) {
      setActiveItemId(id);
      setOriginalCanvas(item.sourceCanvas);
      setResultCanvas(item.resultCanvas);
    }
  };

  const toggleItemSelection = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllItems = () => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  };

  const deselectAllItems = () => {
    setSelectedIds(new Set());
  };

  const reorderItems = (startIndex, endIndex) => {
    const result = Array.from(items);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setItems(result);
  };

  return {
    addFiles,
    removeItem,
    selectItem,
    toggleItemSelection,
    selectAllItems,
    deselectAllItems,
    reorderItems,
    selectedIds,
  };
};

/* 
 useDownloadActions:
 Triggers local downloads for selected or all processed images.
 */
export const useDownloadActions = (
  items,
  selectedIds,
  getDownloadMetadata,
) => {
  const downloadSelected = () => {
    items.forEach((item) => {
      if (selectedIds.has(item.id) && item.resultCanvas) {
        const { filename, mimeType } = getDownloadMetadata(item);
        downloadCanvas(item.resultCanvas, filename, mimeType);
      }
    });
  };

  const downloadAll = () => {
    items.forEach((item) => {
      if (item.resultCanvas) {
        const { filename, mimeType } = getDownloadMetadata(item);
        downloadCanvas(item.resultCanvas, filename, mimeType);
      }
    });
  };

  return {
    downloadSelected,
    downloadAll,
  };
};
