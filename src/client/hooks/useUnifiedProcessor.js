/*
 * Orchestrates processing queues, active models, and background execution flow for batch workflows.
 */
import { useEffect, useRef } from "react";
import { useWorkspace, useService, useAuth } from "../store";
import { useUIStore } from "../store/uiStore";
import { processorEngine } from "../core/processor-engine";
import { useDownloadActions, useQueueActions } from "./useFileUpload";
import {
  createStep,
  removeStep as utilRemoveStep,
  updateStepOptions as utilUpdateStepOptions,
  reorderSteps as utilReorderSteps,
} from "../core/canvas-utils";

export const useUnifiedProcessor = () => {
  // Stable action selectors: Zustand action references never change, so these
  // subscriptions cause zero extra re-renders from UI state changes.
  const updateProgress = useUIStore((s) => s.updateProgress);
  const showToast = useUIStore((s) => s.showToast);

  const workspaceContext = useWorkspace();
  const serviceContext = useService();
  const { refetchSession } = useAuth();

  const lastRunStepsRef = useRef(null);
  const {
    items,
    setItems,
    activeItemId,
    selectedIds,
    workflowSteps,
    setWorkflowSteps,
    originalCanvas,
    setResultCanvas,
    isProcessing,
    setIsProcessing,
    batchMode,
    setBatchMode,
    batchSettingsTarget,
    setBatchSettingsTarget,
  } = workspaceContext;

  const { currentService, getDownloadMetadata } = serviceContext;
  const queueActions = useQueueActions(workspaceContext, showToast);

  /* 
   processItem:
   Shared helper callback that runs a single image item through an AI service engine.
   Feeds progress reports back to the UI progress bar.
  */
  const processItem = async (
    item,
    serviceId,
    options,
    progressPrefix = "",
    overrideCanvas = null,
  ) => {
      const source = overrideCanvas || item.sourceCanvas;
      if (!source) return null;

      try {
        // Execute the low-level processing engine
        const result = await processorEngine.process(
          serviceId,
          source,
          options,
          (prog, msg) => updateProgress(prog, `${progressPrefix}${msg}`),
        );

        // Verify the returned object is a renderable canvas variant
        const finalCanvas = result.canvas || result;
        const isValid =
          finalCanvas &&
          (finalCanvas instanceof HTMLCanvasElement ||
            finalCanvas instanceof OffscreenCanvas ||
            finalCanvas instanceof ImageBitmap);

        return isValid ? finalCanvas : null;
      } catch (err) {
        console.error(`Processing failed for ${item.name}:`, err);
        throw err;
      }
    };

  /* 
   _resetItems:
   Resets status, step details, and results of all queue items back to 'pending'.
  */
  const _resetItems = (itemsList) => {
    return itemsList.map((item) => {
      // Clear background removal and blur caches to prevent blank images or stale cache bugs on rerun
      if (item.sourceCanvas) {
        const bgCache = item.sourceCanvas._bgRemovalCache;
        if (bgCache && bgCache.maskBitmap) {
          try { bgCache.maskBitmap.close(); } catch (_) {}
        }
        delete item.sourceCanvas._bgRemovalCache;

        const blurCache = item.sourceCanvas._blurCache;
        if (blurCache && blurCache.lastSourceBitmap) {
          try { blurCache.lastSourceBitmap.close(); } catch (_) {}
        }
        delete item.sourceCanvas._blurCache;
      }

      // Dispose any intermediate canvas results in the step results list
      if (item.stepResults) {
        Object.values(item.stepResults).forEach((res) => {
          if (res.resultCanvas?.close) {
            try { res.resultCanvas.close(); } catch (_) {}
          }
        });
      }

      return {
        ...item,
        status: "pending",
        error: null,
        progress: 0,
        resultCanvas: null,
        stepResults: {},
      };
    });
  };

  const updateItemOverride = (itemId, serviceOrStepId, key, value) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== itemId) return item;
        const currentOverrides = item.settingsOverrides || {};
        const stepOverrides = currentOverrides[serviceOrStepId] || {};
        return {
          ...item,
          settingsOverrides: {
            ...currentOverrides,
            [serviceOrStepId]: {
              ...stepOverrides,
              [key]: value,
            },
          },
        };
      })
    );
  };

  const executeSingleItemInBatch = async (serviceId, globalOptions) => {
      const itemId = batchSettingsTarget;
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      setIsProcessing(true);
      const workingItems = [...items];
      const itemIdx = workingItems.findIndex((ni) => ni.id === itemId);

      workingItems[itemIdx].status = "processing";
      setItems([...workingItems]);

      try {
        const itemOverrides = item.settingsOverrides?.[serviceId] || {};
        const activeOptions = { ...globalOptions, ...itemOverrides };

        const result = await processItem(item, serviceId, activeOptions, `[Selective] `);
        workingItems[itemIdx].resultCanvas = result;
        workingItems[itemIdx].status = "done";
        
        if (itemId === activeItemId) {
          setResultCanvas(result);
        }
      } catch (err) {
        workingItems[itemIdx].status = "error";
        workingItems[itemIdx].error = err.message;
      }

      setItems([...workingItems]);
      setIsProcessing(false);
      showToast("Selected image processed successfully", "success");
      refetchSession?.();
    };

  const executeSingleItemInWorkflow = async () => {
      const itemId = batchSettingsTarget;
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      setIsProcessing(true);
      const workingItems = [...items];
      const itemIdx = workingItems.findIndex((ni) => ni.id === itemId);

      workingItems[itemIdx] = {
        ...item,
        status: "processing",
      };
      setItems([...workingItems]);

      let currentCanvas = item.sourceCanvas;

      try {
        for (let j = 0; j < workflowSteps.length; j++) {
          const step = workflowSteps[j];
          const prefix = `Step ${j + 1}/${workflowSteps.length} [Selective]: `;

          const itemOverrides = item.settingsOverrides?.[step.id] || {};
          const activeOptions = { ...step.options, ...itemOverrides };

          const result = await processItem(
            item,
            step.serviceId,
            activeOptions,
            prefix,
            currentCanvas,
          );

          if (result) {
            currentCanvas = result;
            workingItems[itemIdx].stepResults = {
              ...workingItems[itemIdx].stepResults,
              [step.id]: { resultCanvas: result, status: "done" },
            };
          } else {
            throw new Error("Workflow step returned empty canvas");
          }
        }

        workingItems[itemIdx] = {
          ...workingItems[itemIdx],
          resultCanvas: currentCanvas,
          status: "done",
        };

        if (itemId === activeItemId) {
          setResultCanvas(currentCanvas);
        }
      } catch (err) {
        workingItems[itemIdx] = {
          ...workingItems[itemIdx],
          status: "error",
          error: err.message,
        };
      }

      setItems([...workingItems]);
      setIsProcessing(false);
      showToast("Selected image workflow complete", "success");
      refetchSession?.();
    };

  // --- Single Processor Strategy Implementation ---
  const executeSingle = async (serviceId, options, sourceCanvas) => {
      setIsProcessing(true); // Lock the UI viewport by marking processing in-progress
      try {
        // Call the pure processing engine with optional progress report listeners
        const result = await processorEngine.process(
          serviceId,
          sourceCanvas,
          options,
          (prog, msg) => updateProgress(prog, msg),
        );

        // Extract the output canvas or image-data variant
        const canvas = result.canvas || result;
        const isValid =
          canvas &&
          (canvas instanceof HTMLCanvasElement ||
            canvas instanceof OffscreenCanvas ||
            canvas instanceof ImageBitmap);

        // If output is valid, sync it back to the editor result view and set status to done
        if (isValid) {
          setResultCanvas(canvas);
          setItems((prev) =>
            prev.map((item) =>
              item.id === activeItemId
                ? { ...item, status: "done", error: null, resultCanvas: canvas }
                : item,
            ),
          );
          showToast("Processing complete", "success");
          refetchSession?.();
        }

        return result;
      } catch (err) {
        showToast(`Error: ${err.message}`, "error");
        setResultCanvas(null);
        setItems((prev) =>
          prev.map((item) =>
            item.id === activeItemId
              ? { ...item, status: "error", error: err.message }
              : item,
          ),
        );
      } finally {
        setIsProcessing(false); // Release UI lock
      }
    };

  // --- Batch Processor Strategy Implementation ---
  const executeBatch = async (serviceId, options, runOptions = {}) => {
      const { forceReset = false } = runOptions;

      // Step 1: Initialize current items queue (resetting status if rerun/reset is requested)
      let currentItems = [...items];
      if (forceReset) {
        currentItems = _resetItems(currentItems);
        setItems(currentItems);
      }

      // Step 2: Extract only items that still need to be processed
      const pendingItems = currentItems.filter((i) => i.status !== "done");
      if (pendingItems.length === 0)
        return showToast("No images to process", "info");

      setIsProcessing(true); // Lock workspace viewport
      const workingItems = [...currentItems];

      // Step 3: Run sequentially through the pending items
      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        const itemIdx = workingItems.findIndex((ni) => ni.id === item.id);

        // Mark the active item status as 'processing'
        workingItems[itemIdx].status = "processing";
        setItems([...workingItems]);

        try {
          const itemOverrides = item.settingsOverrides?.[serviceId] || {};
          const activeOptions = { ...options, ...itemOverrides };

          // Execute the processing helper with progress prefix identifiers (e.g. "[1/5] Processing...")
          const result = await processItem(
            item,
            serviceId,
            activeOptions,
            `[${i + 1}/${pendingItems.length}] `,
          );
          workingItems[itemIdx].resultCanvas = result;
          workingItems[itemIdx].status = "done";
        } catch (err) {
          workingItems[itemIdx].status = "error";
          workingItems[itemIdx].error = err.message;
        }

        // Commit local item changes back to global list
        setItems([...workingItems]);
      }

      setIsProcessing(false); // Unlock workspace viewport
      showToast("Batch processing complete", "success");
      refetchSession?.();
    };

  // --- Workflow Processor Strategy Implementation ---
  const executeWorkflow = async (options = {}) => {
      const { forceReset = false } = options;
      if (workflowSteps.length === 0)
        return showToast("Add steps to your pipeline first", "warning");

      const stepsSerialized = JSON.stringify(
        workflowSteps.map((s) => ({
          id: s.id,
          serviceId: s.serviceId,
          options: s.options,
        })),
      );
      const stepsChanged =
        lastRunStepsRef.current !== null &&
        lastRunStepsRef.current !== stepsSerialized;
      lastRunStepsRef.current = stepsSerialized;

      const shouldReset = forceReset || stepsChanged;

      // Step 1: Initialize current items queue (resetting status if rerun/reset is requested)
      let currentItems = [...items];
      if (shouldReset) {
        currentItems = _resetItems(currentItems);
        setItems(currentItems);
      }

      // Step 2: Extract items that still need processing
      const pendingItems = currentItems.filter((i) => i.status !== "done");
      if (pendingItems.length === 0) {
        if (items.length === 0) return showToast("No images uploaded", "info");
        return showToast("All images already processed", "info");
      }

      setIsProcessing(true); // Lock workspace viewport
      const workingItems = [...currentItems];

      try {
        // Step 3: Loop sequentially through each workflow step (Step-First / Breadth-First)
        for (let j = 0; j < workflowSteps.length; j++) {
          const step = workflowSteps[j];

          // Run this step on all pending images that haven't encountered errors yet
          for (let i = 0; i < pendingItems.length; i++) {
            const item = pendingItems[i];
            const itemIdx = workingItems.findIndex((ni) => ni.id === item.id);

            // Skip if this item encountered an error in a previous step
            if (workingItems[itemIdx].status === "error") continue;

            // Lock current item status to 'processing'
            workingItems[itemIdx] = {
              ...workingItems[itemIdx],
              status: "processing",
            };
            setItems([...workingItems]);

            // Input is either the result of the previous step or the original source Canvas
            const previousStep = j > 0 ? workflowSteps[j - 1] : null;
            const currentCanvas = previousStep
              ? workingItems[itemIdx].stepResults[previousStep.id]?.resultCanvas
              : item.sourceCanvas;

            if (!currentCanvas) {
              workingItems[itemIdx] = {
                ...workingItems[itemIdx],
                status: "error",
                error: "Input source canvas not available for this step",
              };
              setItems([...workingItems]);
              continue;
            }

            const prefix = `Step ${j + 1}/${workflowSteps.length} [Image ${i + 1}/${pendingItems.length}]: `;

            try {
              const itemOverrides = item.settingsOverrides?.[step.id] || {};
              const activeOptions = { ...step.options, ...itemOverrides };

              // Run processing with the resolved canvas input
              const result = await processItem(
                item,
                step.serviceId,
                activeOptions,
                prefix,
                currentCanvas,
              );

              if (result) {
                workingItems[itemIdx].stepResults = {
                  ...workingItems[itemIdx].stepResults,
                  [step.id]: { resultCanvas: result, status: "done" },
                };

                // If this is the final step, store it as the final resultCanvas and set status to "done"
                if (j === workflowSteps.length - 1) {
                  workingItems[itemIdx] = {
                    ...workingItems[itemIdx],
                    resultCanvas: result,
                    status: "done",
                  };

                  // Update the live canvas result if this item is currently selected in the viewport
                  if (item.id === activeItemId) {
                    setResultCanvas(result);
                  }
                }
              } else {
                throw new Error("Step returned an empty result canvas");
              }
            } catch (err) {
              workingItems[itemIdx] = {
                ...workingItems[itemIdx],
                status: "error",
                error: err.message,
              };
            }

            setItems([...workingItems]);
          }
        }
      } catch (globalErr) {
        console.error("Workflow global execution failed:", globalErr);
      } finally {
        setIsProcessing(false); // Release workspace viewport lock
      }

      showToast("Workflow pipeline complete", "success");
      refetchSession?.();
    };

  // --- Pipeline Steps Construction APIs ---
  const addStep = (serviceId, options) => {
      setWorkflowSteps((prev) => [...prev, createStep(serviceId, options)]);
    };

  const removeStep = (id) => {
      setWorkflowSteps((prev) => utilRemoveStep(prev, id));
    };

  const updateStepOptions = (id, options) => {
      setWorkflowSteps((prev) => utilUpdateStepOptions(prev, id, options));
    };

  const reorderSteps = (startIndex, endIndex) => {
      setWorkflowSteps((prev) => utilReorderSteps(prev, startIndex, endIndex));
    };

  // Download actions configuration
  const { downloadSelected, downloadAll } = useDownloadActions(
    items,
    selectedIds,
    getDownloadMetadata,
  );

  // Helper utility to completely reset the status indicators of all queue items
  const resetItemsStatus = () => {
    setItems((prevItems) => _resetItems(prevItems));
  };

  const resetProcessingState = (shouldResetItems = true) => {
      setIsProcessing(false);
      updateProgress(0, "");
      if (shouldResetItems) {
        resetItemsStatus();
      }
    };

  // --- Mapped Execution Router & Active State Detections ---
  const batchAvailable = ![
    "image-editor",
    "object-segmentation",
    "magic-erase",
  ].includes(currentService.id);
  const activeMode =
    currentService.id === "workflows"
      ? "workflow"
      : batchAvailable && batchMode === "batch"
        ? "batch"
        : "single";

  // Service changes synchronization pass
  const lastServiceIdRef = useRef(currentService.id);
  useEffect(() => {
    // Only reset the workspace if the service actually changed to a DIFFERENT service,
    // and we are not currently executing a process job.
    if (currentService.id !== lastServiceIdRef.current) {
      lastServiceIdRef.current = currentService.id;
      if (!isProcessing) {
        resetProcessingState(currentService.id !== "workflows");
      }
    }
  }, [currentService.id, isProcessing]);


  // Central Router: Delegates execution flow dynamically to unified methods
  const execute = async (options = {}, runOptions = {}) => {
      switch (activeMode) {
        case "workflow":
          return executeWorkflow(runOptions);
        case "batch":
          return executeBatch(currentService.id, options, runOptions);
        default:
          return executeSingle(currentService.id, options, originalCanvas);
      }
    };

  // Context-compatible properties derived dynamically for UI elements
  const activeItemIdDerived =
    items.find((i) => i.id === activeItemId)?.id || items[0]?.id || null;
  const doneCount =
    activeMode === "single"
      ? 0
      : items.filter((i) => i.status === "done").length;

  const setMode = (nextMode) => {
      setBatchMode(nextMode);
      resetProcessingState(true);
    };

  // --- Final Unified Interface API Return ---
  const result = {
    executeSingle,
    executeBatch,
    executeWorkflow,
    resetItemsStatus,
    ...queueActions,
    downloadSelected,
    downloadAll,
    items,
    selectedIds: queueActions.selectedIds,
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
    setMode,
    activeItemId: activeItemIdDerived,
    doneCount,
    processAll: (options) => execute(options),
    rerunAll: (options) => execute(options, { forceReset: true }),
    
    // Per-image custom settings states & selective actions
    batchSettingsTarget,
    setBatchSettingsTarget,
    updateItemOverride,
    executeSingleItemInBatch,
    executeSingleItemInWorkflow,
  };

  return result;
};
