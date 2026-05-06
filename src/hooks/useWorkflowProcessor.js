/**
 * useWorkflowProcessor — React hook wrapping BatchQueue for multi-step service processing.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BatchQueue } from '../core/batch-queue';
import { downloadCanvas } from '../core/canvas-utils';
import { processorEngine } from '../core/processor-engine';


export const useWorkflowProcessor = () => {
  const {
    currentService,
    setOriginalCanvas,
    setResultCanvas,
    setIsProcessing,
    updateProgress,
    showToast,
    getDownloadMetadata,
  } = useApp();

  // Workflow steps: Array of { id, serviceId, options }
  const [workflowSteps, setWorkflowSteps] = useState([]);
  
  // State storage
  const [currentState, setCurrentState] = useState({
    items: [],
    activeItemId: null,
    selectedIds: new Set(),
  });

  const { items, activeItemId, selectedIds } = currentState;
  const queueRef = useRef(new BatchQueue());

  const getQueue = useCallback(() => queueRef.current, []);

  const syncState = useCallback(() => {
    const q = getQueue();
    setCurrentState(prev => ({
      ...prev,
      items: [...q.items],
      selectedIds: new Set(q.selectedIds)
    }));
  }, [getQueue]);

  // Map step inputs
  const addStep = useCallback((serviceId, defaultOptions = {}) => {
    setWorkflowSteps(prev => [
      ...prev,
      { id: `step_${Date.now()}`, serviceId, options: defaultOptions }
    ]);
  }, []);

  const updateStepOptions = useCallback((stepId, options) => {
    setWorkflowSteps(prev => prev.map(s => s.id === stepId ? { ...s, options } : s));
  }, []);

  const removeStep = useCallback((stepId) => {
    setWorkflowSteps(prev => prev.filter(s => s.id !== stepId));
  }, []);

  const reorderSteps = useCallback((fromIdx, toIdx) => {
    setWorkflowSteps(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  /**
   * Sync canvases when switching selected items
   */
  useEffect(() => {
    if (activeItemId) {
      const q = getQueue();
      const item = q.getItem(activeItemId);
      if (item) {
        setOriginalCanvas(item.sourceCanvas);
        // Display the very final step's visual canvas if available
        const finalCanvas = q.getLatestCanvas(item.id, workflowSteps);
        setResultCanvas(finalCanvas !== item.sourceCanvas ? finalCanvas : null);
      }
    }
  }, [activeItemId, workflowSteps]);

  /**
   * Add files to the queue
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
    
    setCurrentState(prev => ({
      ...prev,
      items: [...q.items],
      selectedIds: new Set(q.selectedIds),
      activeItemId: newActiveId
    }));
    
    showToast(`Added ${newItems.length} image(s) to workflow`, 'success');
  }, [getQueue, activeItemId, setOriginalCanvas, setResultCanvas, showToast]);

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
        setResultCanvas(q.getLatestCanvas(item.id, workflowSteps) || null);
      } else {
        setOriginalCanvas(null);
        setResultCanvas(null);
      }
    }
    
    setCurrentState(prev => ({
      ...prev,
      items: [...q.items],
      selectedIds: new Set(q.selectedIds),
      activeItemId: newActiveId
    }));
  }, [getQueue, activeItemId, workflowSteps, setOriginalCanvas, setResultCanvas]);

  const toggleItemSelection = useCallback((id) => {
    getQueue().toggleSelect(id);
    syncState();
  }, [getQueue, syncState]);

  const selectItem = useCallback((id) => {
    const q = getQueue();
    const item = q.getItem(id);
    if (!item) return;

    setCurrentState(prev => ({ ...prev, activeItemId: id }));
  }, [getQueue]);

  const selectAllItems = useCallback(() => {
    getQueue().selectAll();
    syncState();
  }, [getQueue, syncState]);

  const deselectAllItems = useCallback(() => {
    getQueue().deselectAll();
    syncState();
  }, [getQueue, syncState]);




  /**
   * Process all workflow steps for queued items
   */
  const processWorkflow = useCallback(async () => {
    if (workflowSteps.length === 0) {
      showToast('Add at least one step to the workflow', 'warning');
      return;
    }

    const q = getQueue();
    const pendingItems = q.items.filter(item => item.status === 'pending' || item.status === 'error');
    if (pendingItems.length === 0) {
      showToast('No pending images to process', 'warning');
      return;
    }

    setIsProcessing(true);
    let completed = 0;
    const total = pendingItems.length;


    // Process each item through the pipeline
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
      setCurrentState(prev => ({ ...prev, activeItemId: item.id }));

      let currentInputCanvas = item.sourceCanvas;
      let stepFailed = false;

      for (let i = 0; i < workflowSteps.length; i++) {
         const step = workflowSteps[i];
         
         try {
           updateProgress(
             i / workflowSteps.length, 
             `[${completed + 1}/${total}] Step ${i + 1}/${workflowSteps.length}: ${step.serviceId}`
           );

           const result = await processorEngine.process(
             step.serviceId,
             currentInputCanvas,
             step.options,
             (prog, msg) => {
                const globalProg = (i + Math.max(0, Math.min(1, prog))) / workflowSteps.length;
                updateProgress(globalProg, `[${completed + 1}/${total}] ${step.serviceId}: ${msg}`);
             }
           );


           const resultData = { resultCanvas: null, resultText: null, status: 'done', error: null };

           if (typeof result === 'string') {
               resultData.resultText = result;
               // Text doesn't overwrite the active visual canvas stream
               resultData.resultCanvas = currentInputCanvas; 
           } else {
               const finalCanvas = result?.canvas || result;
               const isValid = finalCanvas && (
                 finalCanvas instanceof HTMLCanvasElement ||
                 finalCanvas instanceof OffscreenCanvas ||
                 finalCanvas instanceof ImageBitmap
               );
               
               if (isValid) {
                   resultData.resultCanvas = finalCanvas;
                   currentInputCanvas = finalCanvas; // Pass to next step
               } else {
                   throw new Error('Invalid canvas returned from step');
               }
           }
           
           q.setStepResult(item.id, step.id, resultData);
           setResultCanvas(currentInputCanvas);

         } catch (err) {
           console.error(`Workflow step ${step.serviceId} failed for ${item.name}:`, err);
           q.setStatus(item.id, 'error', `Step ${i + 1} failed: ${err.message}`);
           q.setStepResult(item.id, step.id, { status: 'error', error: err.message });
           stepFailed = true;
           break;
         }
      }

      if (!stepFailed) {
         q.setResult(item.id, currentInputCanvas); // Final overall success
      }
      
      completed++;
      syncState();
    }

    setIsProcessing(false);
    updateProgress(1, `Workflow complete: ${q.doneCount}/${total} succeeded`);
    showToast(`Workflow complete! ${q.doneCount} images fully processed.`, 'success');

    const firstDone = q.items.find(i => i.status === 'done');
    if (firstDone) {
      setCurrentState(prev => ({ ...prev, activeItemId: firstDone.id }));
      setOriginalCanvas(firstDone.sourceCanvas);
      setResultCanvas(q.getLatestCanvas(firstDone.id, workflowSteps));
    }

  }, [workflowSteps, getQueue, syncState, setIsProcessing, updateProgress, setOriginalCanvas, setResultCanvas, showToast]);


  const downloadTextFile = (text, filename) => {
     const blob = new Blob([text], { type: 'text/plain' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = filename;
     a.click();
     URL.revokeObjectURL(url);
  };

  const executeDownloads = async (resultsToDownload) => {
    if (resultsToDownload.length === 0) {
      showToast('No relevant items to download', 'warning');
      return;
    }

    for (let i = 0; i < resultsToDownload.length; i++) {
        const item = resultsToDownload[i];
        const extName = item.name.replace(/\.[^/.]+$/, '');
        
        // 1. Download deepest canvas
        const lastStep = workflowSteps.length > 0 ? workflowSteps[workflowSteps.length - 1] : null;
        const finalCanvas = getQueue().getLatestCanvas(item.id, workflowSteps);
        if (finalCanvas && finalCanvas !== item.sourceCanvas) {
           const { filename, mimeType } = getDownloadMetadata(item, lastStep?.serviceId, finalCanvas);
           await downloadCanvas(finalCanvas, filename, mimeType);
        }

        // 2. Download any text outputs
        if (item.stepResults) {
            Object.values(item.stepResults).forEach((stepRes, idx) => {
                if (stepRes.resultText) {
                    downloadTextFile(stepRes.resultText, `${extName}_workflow_${idx}.txt`);
                }
            });
        }

        if (i < resultsToDownload.length - 1) await new Promise(r => setTimeout(r, 400));
    }

    const q = getQueue();
    q.markDownloaded(resultsToDownload.map(r => r.id));
    syncState();
    showToast(`Downloaded ${resultsToDownload.length} workflow result(s)`, 'success');
  };

  const downloadSelected = () => executeDownloads(getQueue().getSelectedResults());
  const downloadAll = () => executeDownloads(getQueue().getUndownloadedResults());

  const previewStep = useCallback((stepId) => {
    const q = getQueue();
    const item = q.getItem(activeItemId);
    if (!item || !item.stepResults) {
        showToast('No preview available for this step yet', 'warning');
        return;
    }

    const stepResult = item.stepResults[stepId];
    if (stepResult && stepResult.resultCanvas) {
        setResultCanvas(stepResult.resultCanvas);
        showToast('Previewing intermediate step result', 'success');
    } else if (stepResult && stepResult.resultText) {
        showToast(`Text Result: ${stepResult.resultText}`, 'success');
    } else {
        showToast('No preview available for this step yet', 'warning');
    }
  }, [activeItemId, getQueue, setResultCanvas, showToast]);

  const downloadStep = useCallback(async (stepId) => {
    const q = getQueue();
    const item = q.getItem(activeItemId);
    if (!item || !item.stepResults) return;

    const stepResult = item.stepResults[stepId];
    if (!stepResult) {
       showToast('No result to download for this step yet', 'warning');
       return;
    }
    
    const extName = item.name.replace(/\.[^/.]+$/, '');
    
    if (stepResult.resultCanvas && stepResult.resultCanvas !== item.sourceCanvas) {
         const step = workflowSteps.find(s => s.id === stepId);
         const { filename, mimeType } = getDownloadMetadata(item, step?.serviceId, stepResult.resultCanvas);
         await downloadCanvas(stepResult.resultCanvas, filename, mimeType);
    }
    if (stepResult.resultText) {
         downloadTextFile(stepResult.resultText, `${extName}_step_${stepId}.txt`);
    }
  }, [activeItemId, getQueue, showToast]);

  const resetQueue = useCallback(() => {
    getQueue().reset();
    setCurrentState({
      items: [],
      activeItemId: null,
      selectedIds: new Set()
    });
  }, [getQueue]);

  const clearMemory = useCallback(() => {
    const q = getQueue();
    q.items.forEach(item => q.clearStepResults(item.id));
    syncState();
    showToast('Intermediate workflow memory cleared', 'success');
  }, [getQueue, syncState, showToast]);

  return {
    workflowSteps,
    addStep,
    removeStep,
    reorderSteps,
    updateStepOptions,
    
    items,
    activeItemId,
    selectedIds,
    doneCount: getQueue().doneCount,
    pendingCount: getQueue().pendingCount,
    
    addFiles,
    removeItem,
    selectItem,
    toggleItemSelection,
    selectAllItems,
    deselectAllItems,
    processWorkflow,
    downloadSelected,
    downloadAll,
    previewStep,
    downloadStep,
    resetQueue,
    clearMemory,
  };
};
