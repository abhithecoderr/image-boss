import { useCallback, useMemo, useState, useEffect } from 'react';
import { useUI, useWorkspace, useService } from '../context/AppContext';
import { useUnifiedProcessor } from './useUnifiedProcessor';
import { OPERATION_MODE } from '../config/app';

export const useAppEngine = () => {
  const { originalCanvas, resultCanvas, items, workflowSteps, setActiveItemId, activeItemId, selectedIds, batchMode, setBatchMode } = useWorkspace();
  const { currentService } = useService();

  const unified = useUnifiedProcessor();

  const batchAvailable = useMemo(() => {
    return !['image-editor', 'object-segmentation', 'magic-erase'].includes(currentService.id);
  }, [currentService.id]);

  const activeMode = useMemo(() => {
    if (currentService.id === 'workflows') return OPERATION_MODE.WORKFLOW;
    if (!batchAvailable) return OPERATION_MODE.SINGLE;
    return batchMode === 'batch' ? OPERATION_MODE.BATCH : OPERATION_MODE.SINGLE;
  }, [currentService.id, batchMode, batchAvailable]);

  // --- Service State Isolation ---
  // When switching between individual services, clear batch results to prevent leakage.
  // We DO NOT clear results in WORKFLOW mode because workflows depend on passing data between steps.
  useEffect(() => {
    if (activeMode !== OPERATION_MODE.WORKFLOW) {
       unified.resetItemsStatus();
    }
  }, [currentService.id, activeMode]); // Run when service OR mode changes (excluding workflow)

  // Stable unified methods - extract these so they don't depend on the volatile 'engine' object
  const { 
    addFiles, removeItem, selectItem, toggleItemSelection, 
    selectAllItems, deselectAllItems, reorderItems, 
    downloadSelected, downloadAll, resetItemsStatus
  } = unified;

  const engine = useMemo(() => {
    const isWorkflow = activeMode === OPERATION_MODE.WORKFLOW;
    const isBatch = activeMode === OPERATION_MODE.BATCH;
    
    return {
      mode: isWorkflow ? 'workflow' : (isBatch ? 'batch' : 'single'),
      items: (isWorkflow || isBatch) ? items : [],
      activeItemId: isWorkflow ? items[0]?.id : (isBatch ? (items.find(i => i.id === activeItemId)?.id || null) : null),
      selectedIds,
      doneCount: ((isWorkflow || isBatch) ? items : []).filter(i => i.status === 'done').length,
      batchAvailable,
      setMode: setBatchMode,
      // Stable methods
      addFiles,
      removeItem,
      selectItem,
      toggleItemSelection,
      selectAllItems,
      deselectAllItems,
      reorderItems,
      downloadSelected,
      downloadAll,
      resetItemsStatus,
      processAll: (options) => {
        if (activeMode === OPERATION_MODE.WORKFLOW) return unified.executeWorkflow();
        return unified.executeBatch(currentService.id, options);
      },
      rerunAll: (options) => {
        if (activeMode === OPERATION_MODE.WORKFLOW) return unified.executeWorkflow({ forceReset: true });
        return unified.executeBatch(currentService.id, options, { forceReset: true });
      },
    };
    // Removed 'unified' from dependencies as we extracted its methods
  }, [activeMode, batchMode, items, activeItemId, selectedIds, currentService.id, setBatchMode, unified.executeWorkflow, unified.executeBatch]);



  const execute = useCallback(async (options = {}, runOptions = {}) => {
    if (activeMode === OPERATION_MODE.WORKFLOW) return unified.executeWorkflow(runOptions);
    if (activeMode === OPERATION_MODE.BATCH) return unified.executeBatch(currentService.id, options, runOptions);
    return unified.executeSingle(currentService.id, options, originalCanvas);
  }, [activeMode, currentService.id, originalCanvas, unified.executeWorkflow, unified.executeBatch, unified.executeSingle]);

  return {
    mode: activeMode,
    engine,
    execute,
    unified
  };
};


