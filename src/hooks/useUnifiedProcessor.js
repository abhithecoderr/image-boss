import { useCallback, useEffect } from 'react';
import { useUI, useWorkspace, useService } from '../context/AppContext';
import { processorEngine } from '../core/processor-engine';
import { createBatchItem, disposeBatchItem } from '../core/BatchItem';
import { loadImage, imageToCanvas, downloadCanvas, canvasToThumbURL } from '../core/canvas-utils';

// Import strategy-specific sub-hooks (Delegate Pattern)
import { useSingleProcessor } from './useSingleProcessor';
import { useBatchProcessor } from './useBatchProcessor';
import { useWorkflowProcessor } from './useWorkflowProcessor';

/* 
 useUnifiedProcessor:
 The single source of truth for all image processing logic.
 Orchestrates Single, Batch, and Workflow pipelines using a unified state and routing system.
*/
export const useUnifiedProcessor = () => {
  // --- Context Hooks Extraction ---
  const uiContext = useUI();                 // UI states (progress tracking, notifications, toasts)
  const workspaceContext = useWorkspace();   // Active workspace files, canvases, and step queues
  const serviceContext = useService();       // Current AI services configurations and metadata

  const { updateProgress, showToast } = uiContext;
  const {
    items, setItems,
    activeItemId, setActiveItemId,
    selectedIds, setSelectedIds,
    workflowSteps,
    originalCanvas, originalFile,
    setOriginalCanvas, setResultCanvas,
    setIsProcessing,
    batchMode, setBatchMode
  } = workspaceContext;

  const { currentService, getDownloadMetadata } = serviceContext;

  /* 
   processItem:
   Shared helper callback that runs a single image item through an AI service engine.
   Feeds progress reports back to the UI progress bar.
  */
  const processItem = useCallback(async (item, serviceId, options, progressPrefix = '', overrideCanvas = null) => {
    const source = overrideCanvas || item.sourceCanvas;
    if (!source) return null;

    try {
      // Execute the low-level processing engine
      const result = await processorEngine.process(
        serviceId,
        source,
        options,
        (prog, msg) => updateProgress(prog, `${progressPrefix}${msg}`)
      );

      // Verify the returned object is a renderable canvas variant
      const finalCanvas = result.canvas || result;
      const isValid = finalCanvas && (
        finalCanvas instanceof HTMLCanvasElement ||
        finalCanvas instanceof OffscreenCanvas ||
        finalCanvas instanceof ImageBitmap
      );

      return isValid ? finalCanvas : null;
    } catch (err) {
      console.error(`Processing failed for ${item.name}:`, err);
      throw err;
    }
  }, [updateProgress]);

  /* 
   _resetItems:
   Resets status, step details, and results of all queue items back to 'pending'.
  */
  const _resetItems = useCallback((itemsList) => {
    return itemsList.map(item => ({
      ...item,
      status: 'pending',
      error: null,
      progress: 0,
      resultCanvas: null,
      stepResults: {}
    }));
  }, []);

  // --- Sub-Hooks Strategy Instantiation ---
  const { executeSingle } = useSingleProcessor(workspaceContext, uiContext);
  const { executeBatch } = useBatchProcessor(workspaceContext, uiContext, processItem, _resetItems);
  const {
    executeWorkflow,
    addStep,
    removeStep,
    updateStepOptions,
    reorderSteps
  } = useWorkflowProcessor(workspaceContext, uiContext, processItem, _resetItems);

  /**
   * --- Queue Management Actions ---
   */

  // Adds multiple files to the workspace processing queue, generating thumbnails asynchronously
  const addFiles = useCallback(async (files) => {
    const newItems = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 5 * 1024 * 1024) {
        showToast(`File ${file.name} is too large (max 5MB)`, 'warning');
        continue;
      }

      const img = await loadImage(file);
      const { canvas } = imageToCanvas(img);

      const item = createBatchItem({
        name: file.name,
        file: file,
        sourceCanvas: canvas
      });
      item.thumbnailUrl = canvasToThumbURL(canvas);
      newItems.push(item);
    }

    setItems(prev => [...prev, ...newItems]);
    if (!activeItemId && newItems.length > 0) {
      setActiveItemId(newItems[0].id);
      setOriginalCanvas(newItems[0].sourceCanvas);
    }
    showToast(`Added ${newItems.length} image(s)`, 'success');
  }, [activeItemId, setItems, setActiveItemId, setOriginalCanvas, showToast]);

  // Removes a specific image from the queue and disposes of its allocated canvases to free RAM/VRAM
  const removeItem = useCallback((id) => {
    setItems(prev => {
      const itemToDispose = prev.find(item => item.id === id);
      if (itemToDispose) disposeBatchItem(itemToDispose);
      return prev.filter(item => item.id !== id);
    });
    if (activeItemId === id) {
      setActiveItemId(null);
      setOriginalCanvas(null);
      setResultCanvas(null);
    }
  }, [activeItemId, setActiveItemId, setOriginalCanvas, setResultCanvas, setItems]);

  // Selects an image from the queue to load as the active canvas in the editor viewport
  const selectItem = useCallback((id) => {
    const item = items.find(i => i.id === id);
    if (item) {
      setActiveItemId(id);
      setOriginalCanvas(item.sourceCanvas);
      setResultCanvas(item.resultCanvas);
    }
  }, [items, setActiveItemId, setOriginalCanvas, setResultCanvas]);

  // Toggles the selection checkbox of a specific queued item for bulk actions
  const toggleItemSelection = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setSelectedIds]);

  // Checks/Selects all loaded items inside the current batch view
  const selectAllItems = useCallback(() => {
    setSelectedIds(new Set(items.map(i => i.id)));
  }, [items, setSelectedIds]);

  // Unchecks/Deselects all loaded items inside the current batch view
  const deselectAllItems = useCallback(() => {
    setSelectedIds(new Set());
  }, [setSelectedIds]);

  // Reorders items in the queue list (supporting drag-and-drop actions)
  const reorderItems = useCallback((startIndex, endIndex) => {
    const result = Array.from(items);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setItems(result);
  }, [items, setItems]);

  /**
   * --- Bulk Downloading Actions ---
   */

  // Triggers client-side downloads for all explicitly checked items that have successfully processed
  const downloadSelected = useCallback(() => {
    items.forEach(item => {
      if (selectedIds.has(item.id) && item.resultCanvas) {
        const { filename, mimeType } = getDownloadMetadata(item);
        downloadCanvas(item.resultCanvas, filename, mimeType);
      }
    });
  }, [items, selectedIds, getDownloadMetadata]);

  // Triggers client-side downloads for all processed items in the queue
  const downloadAll = useCallback(() => {
    items.forEach(item => {
      if (item.resultCanvas) {
        const { filename, mimeType } = getDownloadMetadata(item);
        downloadCanvas(item.resultCanvas, filename, mimeType);
      }
    });
  }, [items, getDownloadMetadata]);

  // Helper utility to completely reset the status indicators of all queue items
  const resetItemsStatus = useCallback(() => {
    const newItems = _resetItems(items);
    setItems(newItems);
    return newItems;
  }, [items, setItems, _resetItems]);

  // --- Mapped Execution Router & Active State Detections ---
  
  // Checks if the current AI service is compatible with batch processing modes
  const batchAvailable = !['image-editor', 'object-segmentation', 'magic-erase'].includes(currentService.id);
  
  // Computes which processing screen mode is active
  const activeMode = currentService.id === 'workflows'
    ? 'workflow'
    : (batchAvailable && batchMode === 'batch' ? 'batch' : 'single');

  // Automatically resets item processing status when shifting between single-image and batch services
  useEffect(() => {
    if (activeMode !== 'workflow') {
      resetItemsStatus();
    }
  }, [currentService.id, activeMode]);

  // Central Router: Delegates execution flow dynamically to correct strategy hooks
  const execute = useCallback(async (options = {}, runOptions = {}) => {
    switch (activeMode) {
      case 'workflow':
        return executeWorkflow(runOptions);
      case 'batch':
        return executeBatch(currentService.id, options, runOptions);
      default:
        return executeSingle(currentService.id, options, originalCanvas);
    }
  }, [activeMode, currentService.id, originalCanvas, executeWorkflow, executeBatch, executeSingle]);

  // Context-compatible properties derived dynamically for UI elements
  const activeItemIdDerived = activeMode === 'workflow' ? (items[0]?.id || null) : (items.find(i => i.id === activeItemId)?.id || null);
  const doneCount = activeMode === 'single' ? 0 : items.filter(i => i.status === 'done').length;

  // --- Final Unified Interface API Return ---
  const result = {
    executeSingle,
    executeBatch,
    executeWorkflow,
    resetItemsStatus,
    addFiles,
    removeItem,
    selectItem,
    toggleItemSelection,
    selectAllItems,
    deselectAllItems,
    reorderItems,
    downloadSelected,
    downloadAll,
    items,
    selectedIds,
    workflowSteps,
    addStep,
    removeStep,
    updateStepOptions,
    reorderSteps,

    // Expose collapsed legacy useAppEngine router properties:
    mode: activeMode,
    execute,
    batchAvailable,
    batchMode,
    setMode: setBatchMode,
    activeItemId: activeItemIdDerived,
    doneCount,
    processAll: (options) => execute(options),
    rerunAll: (options) => execute(options, { forceReset: true }),
  };

  return {
    ...result,
    engine: result,
    unified: result,
  };
};
