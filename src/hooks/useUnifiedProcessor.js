import { useCallback, useEffect } from 'react';
import { useUI, useWorkspace, useService } from '../context/AppContext';
import { processorEngine } from '../core/processor-engine';
import { ProcessingItem } from '../core/ProcessingItem';
import { loadImage, imageToCanvas, downloadCanvas } from '../core/canvas-utils';

/**
 * useUnifiedProcessor — The single source of truth for all image processing logic.
 * Handles Single, Batch, and Workflow pipelines using a standardized state.
 */
export const useUnifiedProcessor = () => {
  const { updateProgress, showToast } = useUI();
  const { 
    items, setItems, 
    activeItemId, setActiveItemId, 
    selectedIds, setSelectedIds,
    workflowSteps, setWorkflowSteps,
    originalCanvas, originalFile,
    setOriginalCanvas, setResultCanvas,
    setIsProcessing
  } = useWorkspace();

  const { getDownloadMetadata } = useService();

  // --- Auto-Sync Single Image to Multi-Mode Queue ---
  useEffect(() => {
    if (items.length === 0 && originalFile && originalCanvas) {
      const item = new ProcessingItem({
        name: originalFile.name,
        file: originalFile,
        sourceCanvas: originalCanvas
      });
      setItems([item]);
      setActiveItemId(item.id);
    }
  }, [items.length, originalFile, originalCanvas, setItems, setActiveItemId]);


  /**
   * Internal helper to run a single item through a specific service
   */
  const processItem = useCallback(async (item, serviceId, options, progressPrefix = '', overrideCanvas = null) => {
    const source = overrideCanvas || item.sourceCanvas;
    if (!source) return null;

    try {
      const result = await processorEngine.process(
        serviceId,
        source,
        options,
        (prog, msg) => updateProgress(prog, `${progressPrefix}${msg}`)
      );

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

  /**
   * STRATEGY: Process Workflow (Pipeline)
   */
  /**
   * Internal helper to reset items status
   */
  const _resetItems = useCallback((itemsList) => {
    return itemsList.map(item => {
      const newItem = Object.assign(
        Object.create(Object.getPrototypeOf(item)),
        item,
        { 
          status: 'pending', 
          error: null, 
          progress: 0,
          resultCanvas: null,
          stepResults: {}
        }
      );
      return newItem;
    });
  }, []);

  /**
   * STRATEGY: Process Workflow (Pipeline)
   */
  const executeWorkflow = useCallback(async (options = {}) => {
    const { forceReset = false } = options;
    if (workflowSteps.length === 0) return showToast('Add steps to your pipeline first', 'warning');
    
    let currentItems = [...items];
    if (forceReset) {
      currentItems = _resetItems(currentItems);
      setItems(currentItems);
    }

    const pendingItems = currentItems.filter(i => i.status !== 'done');
    if (pendingItems.length === 0) {
       if (items.length === 0) return showToast('No images uploaded', 'info');
       return showToast('All images already processed', 'info');
    }

    setIsProcessing(true);
    
    // Work on a local copy to avoid closure issues during the long loop
    const workingItems = [...currentItems];
    
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const itemIdx = workingItems.findIndex(ni => ni.id === item.id);
      
      workingItems[itemIdx] = Object.assign(
        Object.create(Object.getPrototypeOf(item)),
        item,
        { status: 'processing' }
      );
      setItems([...workingItems]);

      let currentCanvas = item.sourceCanvas;
      
      try {
        for (let j = 0; j < workflowSteps.length; j++) {
          const step = workflowSteps[j];
          const prefix = `[${i + 1}/${pendingItems.length}] Step ${j + 1}: `;
          
          const result = await processItem(item, step.serviceId, step.options, prefix, currentCanvas);
          if (result) {
            currentCanvas = result;
            workingItems[itemIdx].stepResults = {
               ...workingItems[itemIdx].stepResults,
               [step.id]: { resultCanvas: result, status: 'done' }
            };
          }
        }
        
        workingItems[itemIdx] = Object.assign(
          Object.create(Object.getPrototypeOf(workingItems[itemIdx])),
          workingItems[itemIdx],
          { 
            resultCanvas: currentCanvas,
            status: 'done' 
          }
        );

        if (item.id === activeItemId) {
          setResultCanvas(currentCanvas);
        }
      } catch (err) {
        workingItems[itemIdx] = Object.assign(
          Object.create(Object.getPrototypeOf(workingItems[itemIdx])),
          workingItems[itemIdx],
          { 
            status: 'error',
            error: err.message
          }
        );
      }
      
      setItems([...workingItems]);
    }

    setIsProcessing(false);
    showToast('Workflow pipeline complete', 'success');
  }, [items, workflowSteps, setItems, setIsProcessing, showToast, processItem, activeItemId, setResultCanvas, _resetItems]);

  /**
   * STRATEGY: Process Batch (Single Service)
   */
  const executeBatch = useCallback(async (serviceId, options, runOptions = {}) => {
    const { forceReset = false } = runOptions;
    
    let currentItems = [...items];
    if (forceReset) {
      currentItems = _resetItems(currentItems);
      setItems(currentItems);
    }

    const pendingItems = currentItems.filter(i => i.status !== 'done');
    if (pendingItems.length === 0) return showToast('No images to process', 'info');

    setIsProcessing(true);
    const workingItems = [...currentItems];

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const itemIdx = workingItems.findIndex(ni => ni.id === item.id);
      
      workingItems[itemIdx].status = 'processing';
      setItems([...workingItems]);

      try {
        const result = await processItem(item, serviceId, options, `[${i + 1}/${pendingItems.length}] `);
        workingItems[itemIdx].resultCanvas = result;
        workingItems[itemIdx].status = 'done';
      } catch (err) {
        workingItems[itemIdx].status = 'error';
        workingItems[itemIdx].error = err.message;
      }
      
      setItems([...workingItems]);
    }

    setIsProcessing(false);
    showToast('Batch processing complete', 'success');
  }, [items, setItems, setIsProcessing, showToast, processItem, _resetItems]);

  /**
   * STRATEGY: Process Single
   */
  const executeSingle = useCallback(async (serviceId, options, sourceCanvas) => {
    setIsProcessing(true);
    try {
      const result = await processorEngine.process(
        serviceId,
        sourceCanvas,
        options,
        (prog, msg) => updateProgress(prog, msg)
      );
      
      const canvas = result.canvas || result;
      const isValid = canvas && (
        canvas instanceof HTMLCanvasElement ||
        canvas instanceof OffscreenCanvas ||
        canvas instanceof ImageBitmap
      );

      if (isValid) {
        setResultCanvas(canvas);
        showToast('Processing complete', 'success');
      }
      
      return result;
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [setIsProcessing, updateProgress, setResultCanvas, showToast]);

  /**
   * Queue Management
   */
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
      
      const item = new ProcessingItem({
        name: file.name,
        file: file,
        sourceCanvas: canvas
      });
      newItems.push(item);
    }

    setItems(prev => [...prev, ...newItems]);
    if (!activeItemId && newItems.length > 0) {
      setActiveItemId(newItems[0].id);
      setOriginalCanvas(newItems[0].sourceCanvas);
    }
    showToast(`Added ${newItems.length} image(s)`, 'success');
  }, [activeItemId, setItems, setActiveItemId, setOriginalCanvas, showToast]);

  const removeItem = useCallback((id) => {
    setItems(prev => {
      const itemToDispose = prev.find(item => item.id === id);
      if (itemToDispose) itemToDispose.dispose();
      return prev.filter(item => item.id !== id);
    });
    if (activeItemId === id) {
      setActiveItemId(null);
      setOriginalCanvas(null);
      setResultCanvas(null);
    }
  }, [activeItemId, setActiveItemId, setOriginalCanvas, setResultCanvas, setItems]);

  const selectItem = useCallback((id) => {
    const item = items.find(i => i.id === id);
    if (item) {
      setActiveItemId(id);
      setOriginalCanvas(item.sourceCanvas);
      setResultCanvas(item.resultCanvas);
    }
  }, [items, setActiveItemId, setOriginalCanvas, setResultCanvas]);

  const toggleItemSelection = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [setSelectedIds]);

  const selectAllItems = useCallback(() => {
    setSelectedIds(new Set(items.map(i => i.id)));
  }, [items, setSelectedIds]);

  const deselectAllItems = useCallback(() => {
    setSelectedIds(new Set());
  }, [setSelectedIds]);

  const reorderItems = useCallback((startIndex, endIndex) => {
    const result = Array.from(items);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setItems(result);
  }, [items, setItems]);

  /**
   * Downloading Logic
   */
  const downloadSelected = useCallback(() => {
    items.forEach(item => {
      if (selectedIds.has(item.id) && item.resultCanvas) {
        const { filename, mimeType } = getDownloadMetadata(item);
        downloadCanvas(item.resultCanvas, filename, mimeType);
      }
    });
  }, [items, selectedIds, getDownloadMetadata]);

  const downloadAll = useCallback(() => {
    items.forEach(item => {
      if (item.resultCanvas) {
        const { filename, mimeType } = getDownloadMetadata(item);
        downloadCanvas(item.resultCanvas, filename, mimeType);
      }
    });
  }, [items, getDownloadMetadata]);

  /**
   * Workflow API
   */
  const addStep = useCallback((serviceId, options) => {
    setWorkflowSteps(prev => [...prev, { id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, serviceId, options }]);
  }, [setWorkflowSteps]);

  const removeStep = useCallback((id) => {
    setWorkflowSteps(prev => prev.filter(step => step.id !== id));
  }, [setWorkflowSteps]);

  const updateStepOptions = useCallback((id, options) => {
    setWorkflowSteps(prev => prev.map(step => step.id === id ? { ...step, options } : step));
  }, [setWorkflowSteps]);

  const reorderStepsWorkflow = useCallback((startIndex, endIndex) => {
    setWorkflowSteps(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, [setWorkflowSteps]);

  const previewStep = useCallback((stepId) => {
    const activeItem = items.find(i => i.id === activeItemId);
    if (!activeItem) return showToast('No active item selected', 'info');
    
    const stepResult = activeItem.stepResults?.[stepId]?.resultCanvas;
    if (stepResult) {
      setResultCanvas(stepResult);
      showToast('Previewing step result', 'info');
    } else {
      showToast('Step result not available yet. Please run the workflow.', 'warning');
    }
  }, [items, activeItemId, setResultCanvas, showToast]);

  const downloadStep = useCallback((stepId) => {
    const activeItem = items.find(i => i.id === activeItemId);
    if (!activeItem) return showToast('No active item selected', 'info');
    
    const stepResult = activeItem.stepResults?.[stepId]?.resultCanvas;
    if (stepResult) {
      const step = workflowSteps.find(s => s.id === stepId);
      const { filename, mimeType } = getDownloadMetadata(activeItem, step?.serviceId, stepResult);
      downloadCanvas(stepResult, filename, mimeType);
    } else {
      showToast('Step result not available yet. Please run the workflow.', 'warning');
    }
  }, [items, activeItemId, workflowSteps, getDownloadMetadata, showToast]);

  const resetItemsStatus = useCallback(() => {
    const newItems = _resetItems(items);
    setItems(newItems);
    return newItems;
  }, [items, setItems, _resetItems]);

  return {
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
    workflowSteps,
    addStep,
    removeStep,
    updateStepOptions,
    reorderSteps: reorderStepsWorkflow,
    previewStep,
    downloadStep
  };
};


