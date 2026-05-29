import { useCallback } from 'react';
import { createStep, removeStep as utilRemoveStep, updateStepOptions as utilUpdateStepOptions, reorderSteps as utilReorderSteps } from '../core/workflow-utils';

/* 
 useWorkflowProcessor:
 Execution strategy for running workflow pipelines and managing pipeline steps.
 Feeds canvas outputs of each processing stage as inputs for the next stage.
*/
export const useWorkflowProcessor = (workspace, ui, processItem, _resetItems) => {
  // Destructure reactive state variables and setters from the workspace/UI controllers
  const {
    items, setItems,
    workflowSteps, setWorkflowSteps,
    activeItemId, setResultCanvas, setIsProcessing
  } = workspace;
  const { showToast } = ui;

  /* 
   executeWorkflow:
   Runs sequential pipeline processing steps for all pending images in the queue.
   Feeds the result of each step as the canvas input source for the next step.
  */
  const executeWorkflow = useCallback(async (options = {}) => {
    const { forceReset = false } = options;
    if (workflowSteps.length === 0) return showToast('Add steps to your pipeline first', 'warning');

    // Step 1: Initialize current items queue (resetting status if rerun/reset is requested)
    let currentItems = [...items];
    if (forceReset) {
      currentItems = _resetItems(currentItems);
      setItems(currentItems);
    }

    // Step 2: Extract items that still need processing
    const pendingItems = currentItems.filter(i => i.status !== 'done');
    if (pendingItems.length === 0) {
       if (items.length === 0) return showToast('No images uploaded', 'info');
       return showToast('All images already processed', 'info');
    }

    setIsProcessing(true); // Lock workspace viewport
    const workingItems = [...currentItems];

    // Step 3: Loop sequentially through each pending image item
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const itemIdx = workingItems.findIndex(ni => ni.id === item.id);

      // Lock current item status to 'processing'
      workingItems[itemIdx] = {
        ...item,
        status: 'processing'
      };
      setItems([...workingItems]);

      let currentCanvas = item.sourceCanvas;

      try {
        // Step 4: Run this image sequentially through all registered pipeline steps
        for (let j = 0; j < workflowSteps.length; j++) {
          const step = workflowSteps[j];
          const prefix = `[${i + 1}/${pendingItems.length}] Step ${j + 1}: `;

          // Run processing with intermediate step results passed down as inputs
          const result = await processItem(item, step.serviceId, step.options, prefix, currentCanvas);
          if (result) {
            currentCanvas = result; // Feed current result as source input for the next step
            workingItems[itemIdx].stepResults = {
               ...workingItems[itemIdx].stepResults,
               [step.id]: { resultCanvas: result, status: 'done' }
            };
          }
        }

        // Store the final pipeline canvas output back into the item results
        workingItems[itemIdx] = {
          ...workingItems[itemIdx],
          resultCanvas: currentCanvas,
          status: 'done'
        };

        // If the processed item is currently selected in the viewport, update the live canvas result
        if (item.id === activeItemId) {
          setResultCanvas(currentCanvas);
        }
      } catch (err) {
        workingItems[itemIdx] = {
          ...workingItems[itemIdx],
          status: 'error',
          error: err.message
        };
      }

      setItems([...workingItems]);
    }

    setIsProcessing(false); // Release workspace viewport lock
    showToast('Workflow pipeline complete', 'success');
  }, [items, workflowSteps, setItems, setIsProcessing, showToast, processItem, activeItemId, setResultCanvas, _resetItems]);

  /* 
   Pipeline Steps Construction APIs
  */

  // Appends a new service step to the current workflow steps list
  const addStep = useCallback((serviceId, options) => {
    setWorkflowSteps(prev => [...prev, createStep(serviceId, options)]);
  }, [setWorkflowSteps]);

  // Removes a step from the workflow list by its identifier
  const removeStep = useCallback((id) => {
    setWorkflowSteps(prev => utilRemoveStep(prev, id));
  }, [setWorkflowSteps]);

  // Updates option configurations of an existing workflow step
  const updateStepOptions = useCallback((id, options) => {
    setWorkflowSteps(prev => utilUpdateStepOptions(prev, id, options));
  }, [setWorkflowSteps]);

  // Reorders steps within the workflow list (supporting drag-and-drop actions)
  const reorderSteps = useCallback((startIndex, endIndex) => {
    setWorkflowSteps(prev => utilReorderSteps(prev, startIndex, endIndex));
  }, [setWorkflowSteps]);

  return {
    executeWorkflow,
    addStep,
    removeStep,
    updateStepOptions,
    reorderSteps
  };
};
