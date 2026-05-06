/**
 * useBatchProcessor — React hook wrapping BatchQueue + existing processor.
 * Includes per-service persistence logic to ensure batch state is saved
 * for each tool independently.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BatchQueue } from '../core/batch-queue';
import { downloadCanvas } from '../core/canvas-utils';
import { processorEngine } from '../core/processor-engine';


// Services that require interactive per-image input and don't support batch
const INTERACTIVE_SERVICES = new Set(['magic-erase', 'object-segmentation']);

export const useBatchProcessor = () => {
  const {
    currentService,
    setOriginalCanvas,
    setResultCanvas,
    setIsProcessing,
    updateProgress,
    showToast,
    getDownloadMetadata,
  } = useApp();

  // Multi-service state storage
  // { [serviceId]: { mode, items, activeItemId, selectedIds } }
  const [serviceStates, setServiceStates] = useState({});
  const queuesRef = useRef({}); // { [serviceId]: BatchQueue }


  const serviceId = currentService.id;

  // Derive current service batch state
  const currentState = useMemo(() => {
    return serviceStates[serviceId] || {
      mode: 'single',
      items: [],
      activeItemId: null,
      selectedIds: new Set(),
    };
  }, [serviceStates, serviceId]);

  const { mode, items, activeItemId, selectedIds } = currentState;

  // Ensure queue exists for current service
  const getQueue = useCallback((id = serviceId) => {
    if (!queuesRef.current[id]) {
      queuesRef.current[id] = new BatchQueue();
    }
    return queuesRef.current[id];
  }, [serviceId]);

  // Update helper for current service
  const updateCurrentState = useCallback((update) => {
    setServiceStates(prev => ({
      ...prev,
      [serviceId]: {
        ...(prev[serviceId] || {
          mode: 'single',
          items: [],
          activeItemId: null,
          selectedIds: new Set(),
        }),
        ...update
      }
    }));
  }, [serviceId]);

  // Sync queue state → React state for current service
  const syncState = useCallback(() => {
    const q = getQueue();
    updateCurrentState({
      items: [...q.items],
      selectedIds: new Set(q.selectedIds)
    });
  }, [getQueue, updateCurrentState]);

  /**
   * Sync canvases when switching services
   */
  useEffect(() => {
    if (mode === 'batch' && activeItemId) {
      const q = getQueue();
      const item = q.getItem(activeItemId);
      if (item) {
        setOriginalCanvas(item.sourceCanvas);
        setResultCanvas(item.resultCanvas || null);
      }
    }
  }, [serviceId]); // Only trigger when serviceId changes

  /**
   * Check if batch mode is available for the current service
   */
  const batchAvailable = useMemo(() => {
    return !INTERACTIVE_SERVICES.has(serviceId);
  }, [serviceId]);

  /**
   * Set mode (single/batch). Resets batch state when switching to single.
   */
  const setMode = useCallback((newMode) => {
    if (newMode === 'single') {
      getQueue().reset();
      updateCurrentState({
        mode: 'single',
        items: [],
        activeItemId: null,
        selectedIds: new Set()
      });
    } else {
      updateCurrentState({ mode: newMode });
    }
  }, [getQueue, updateCurrentState]);

  /**
   * Add files to the batch queue
   */
  const addFiles = useCallback(async (files) => {
    const q = getQueue();
    const newItems = await q.addFiles(files);
    
    let newActiveId = activeItemId;
    if (newItems.length > 0 && !activeItemId) {
      const first = newItems[0];
      newActiveId = first.id;
      if (first.sourceCanvas) {
        setOriginalCanvas(first.sourceCanvas);
        setResultCanvas(null);
      }
    }
    
    updateCurrentState({
      items: [...q.items],
      selectedIds: new Set(q.selectedIds),
      activeItemId: newActiveId
    });
    
    showToast(`Added ${newItems.length} image(s) to batch`, 'success');
  }, [getQueue, activeItemId, updateCurrentState, setOriginalCanvas, setResultCanvas, showToast]);

  /**
   * Remove an item from the queue
   */
  const removeItem = useCallback((id) => {
    const q = getQueue();
    q.removeItem(id);
    
    let newActiveId = activeItemId;
    if (activeItemId === id) {
      const remaining = q.items;
      newActiveId = remaining.length > 0 ? remaining[0].id : null;
      if (newActiveId) {
        const item = q.getItem(newActiveId);
        setOriginalCanvas(item?.sourceCanvas || null);
        setResultCanvas(item?.resultCanvas || null);
      } else {
        setOriginalCanvas(null);
        setResultCanvas(null);
      }
    }
    
    updateCurrentState({
      items: [...q.items],
      selectedIds: new Set(q.selectedIds),
      activeItemId: newActiveId
    });
  }, [getQueue, activeItemId, updateCurrentState, setOriginalCanvas, setResultCanvas]);

  /**
   * Reorder items via drag-and-drop
   */
  const reorderItems = useCallback((fromIdx, toIdx) => {
    const q = getQueue();
    q.reorder(fromIdx, toIdx);
    syncState();
  }, [getQueue, syncState]);

  /**
   * Set an item as active
   */
  const selectItem = useCallback((id) => {
    const q = getQueue();
    const item = q.getItem(id);
    if (!item) return;

    updateCurrentState({ activeItemId: id });
    setOriginalCanvas(item.sourceCanvas);
    setResultCanvas(item.resultCanvas || null);
  }, [getQueue, updateCurrentState, setOriginalCanvas, setResultCanvas]);

  /**
   * Toggle multi-select
   */
  const toggleItemSelection = useCallback((id) => {
    const q = getQueue();
    q.toggleSelect(id);
    syncState();
  }, [getQueue, syncState]);

  const selectAllItems = useCallback(() => {
    const q = getQueue();
    q.selectAll();
    syncState();
  }, [getQueue, syncState]);

  const deselectAllItems = useCallback(() => {
    const q = getQueue();
    q.deselectAll();
    syncState();
  }, [getQueue, syncState]);



  /**
   * Process all
   */
  const processAll = useCallback(async (options = {}) => {
    const q = getQueue();
    const pendingItems = q.items.filter(item => item.status === 'pending' || item.status === 'error');
    if (pendingItems.length === 0) {
      showToast('No pending images to process', 'warning');
      return;
    }

    setIsProcessing(true);

    let completed = 0;
    const total = pendingItems.length;

    for (const item of pendingItems) {
      if (!item.sourceCanvas) {
        q.setStatus(item.id, 'error', 'No source canvas');
        syncState();
        continue;
      }

      q.setStatus(item.id, 'processing');
      syncState();

      setOriginalCanvas(item.sourceCanvas);
      setResultCanvas(null);
      updateCurrentState({ activeItemId: item.id });

      try {
        updateProgress(0, `Processing ${completed + 1}/${total}: ${item.name}`);

        const result = await processorEngine.process(
          serviceId,
          item.sourceCanvas,
          options,
          (prog, msg) => updateProgress(prog, `[${completed + 1}/${total}] ${msg}`)
        );

        const finalCanvas = result?.canvas || result;
        const isValid = finalCanvas && (
          finalCanvas instanceof HTMLCanvasElement ||
          finalCanvas instanceof OffscreenCanvas ||
          finalCanvas instanceof ImageBitmap
        );

        if (isValid) {
          q.setResult(item.id, finalCanvas);
          setResultCanvas(finalCanvas);
        } else {
          q.setStatus(item.id, 'error', 'Invalid result');
        }
      } catch (err) {
        console.error(`Batch processing failed for ${item.name}:`, err);
        q.setStatus(item.id, 'error', err.message);
      }

      completed++;
      syncState();
    }


    setIsProcessing(false);
    updateProgress(1, `Batch complete: ${q.doneCount}/${total} succeeded`);
    showToast(`Batch processing complete! ${q.doneCount} images processed.`, 'success');

    const firstDone = q.items.find(i => i.status === 'done');
    if (firstDone) {
      updateCurrentState({ activeItemId: firstDone.id });
      setOriginalCanvas(firstDone.sourceCanvas);
      setResultCanvas(firstDone.resultCanvas);
    }
  }, [serviceId, getQueue, updateCurrentState, syncState, setIsProcessing, updateProgress, setOriginalCanvas, setResultCanvas, showToast]);

  /**
   * Download helpers
   */
  const downloadSelected = useCallback(async () => {
    const q = getQueue();
    const results = q.getSelectedResults();
    if (results.length === 0) {
      showToast('No selected items with results to download', 'warning');
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      const { filename, mimeType } = getDownloadMetadata(item, null, item.resultCanvas);
      await downloadCanvas(item.resultCanvas, filename, mimeType);
      if (i < results.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    q.markDownloaded(results.map(r => r.id));
    syncState();
    showToast(`Downloaded ${results.length} result(s)`, 'success');
  }, [getQueue, syncState, showToast, getDownloadMetadata]);

  const downloadAll = useCallback(async () => {
    const q = getQueue();
    const results = q.getUndownloadedResults();
    if (results.length === 0) {
      showToast('No new results to download', 'warning');
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      const { filename, mimeType } = getDownloadMetadata(item, null, item.resultCanvas);
      await downloadCanvas(item.resultCanvas, filename, mimeType);
      if (i < results.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    q.markDownloaded(results.map(r => r.id));
    syncState();
    showToast(`Downloaded ${results.length} result(s)`, 'success');
  }, [getQueue, syncState, showToast, getDownloadMetadata]);

  /**
   * Rerun the entire batch (useful when changing models/settings)
   */
  const rerunAll = useCallback(async (options = {}) => {
    const q = getQueue();
    q.resetItemsStatus();
    syncState();
    // After reset, trigger the standard processAll
    await processAll(options);
  }, [getQueue, syncState, processAll]);

  const resetBatch = useCallback(() => {
    getQueue().reset();
    updateCurrentState({
      items: [],
      activeItemId: null,
      selectedIds: new Set()
    });
  }, [getQueue, updateCurrentState]);

  const clearMemory = useCallback(() => {
    const q = getQueue();
    q.items.forEach(item => q.clearStepResults(item.id));
    syncState();
    showToast('Batch memory cleared', 'success');
  }, [getQueue, syncState, showToast]);

  return {
    mode,
    items,
    activeItemId,
    selectedIds,
    batchAvailable,
    doneCount: getQueue().doneCount,
    pendingCount: getQueue().pendingCount,
    setMode,
    addFiles,
    removeItem,
    reorderItems,
    selectItem,
    toggleItemSelection,
    selectAllItems,
    deselectAllItems,
    processAll,
    rerunAll,
    downloadSelected,
    downloadAll,
    resetBatch,
    clearMemory,
  };
};
