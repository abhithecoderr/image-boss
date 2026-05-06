import { useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useProcessor } from './useProcessor';
import { useBatchProcessor } from './useBatchProcessor';
import { useWorkflowProcessor } from './useWorkflowProcessor';
import { OPERATION_MODE } from '../config/app';

/**
 * useAppEngine — The unified orchestrator hook.
 * Standardizes the API for processing regardless of whether the user is in 
 * Single, Batch, or Workflow mode.
 */
export const useAppEngine = () => {
  const { currentService, originalCanvas, resultCanvas } = useApp();
  
  const single = useProcessor();
  const batch = useBatchProcessor();
  const workflow = useWorkflowProcessor();

  const activeMode = useMemo(() => {
    if (currentService.id === 'workflows') return OPERATION_MODE.WORKFLOW;
    return batch.mode === 'batch' ? OPERATION_MODE.BATCH : OPERATION_MODE.SINGLE;
  }, [currentService.id, batch.mode]);

  const activeEngine = useMemo(() => {
    const singleEngine = {
      mode: 'single',
      items: originalCanvas ? [{
        id: 'single-item',
        sourceCanvas: originalCanvas,
        resultCanvas,
        status: resultCanvas ? 'done' : 'pending',
      }] : [],
      activeItemId: originalCanvas ? 'single-item' : null,
      selectedIds: new Set(),
      batchAvailable: batch.batchAvailable,
      doneCount: resultCanvas ? 1 : 0,
      pendingCount: originalCanvas && !resultCanvas ? 1 : 0,
      setMode: batch.setMode,
      addFiles: batch.addFiles,
      removeItem: () => {},
      reorderItems: () => {},
      selectItem: () => {},
      toggleItemSelection: () => {},
      selectAllItems: () => {},
      deselectAllItems: () => {},
      processAll: (options) => single.process(options),
      rerunAll: (options) => single.process(options),
      downloadSelected: () => {},
      downloadAll: () => {},
      resetBatch: () => {},
      clearMemory: () => {},
    };

    switch (activeMode) {
      case OPERATION_MODE.WORKFLOW: return workflow;
      case OPERATION_MODE.BATCH: return batch;
      default: return singleEngine;
    }
  }, [activeMode, workflow, batch, originalCanvas, resultCanvas, single]);

  const execute = useCallback(async (options = {}) => {
    switch (activeMode) {
      case OPERATION_MODE.WORKFLOW:
        return await workflow.processWorkflow();
      case OPERATION_MODE.BATCH:
        return await batch.processAll(options);
      default:
        return await single.process(options);
    }
  }, [activeMode, single, batch, workflow]);

  const reset = useCallback(() => {
    switch (activeMode) {
      case OPERATION_MODE.WORKFLOW:
        workflow.resetQueue();
        break;
      case OPERATION_MODE.BATCH:
        batch.resetBatch();
        break;
      default:
        // single-mode reset is handled by global resetWorkspace in context
        break;
    }
  }, [activeMode, workflow, batch]);

  return {
    mode: activeMode,
    engine: activeEngine,
    execute,
    reset,
    // Direct access for specialized UI components
    single,
    batch,
    workflow
  };
};
