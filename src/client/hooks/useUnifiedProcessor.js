/*
 * Orchestrates processing queues, active models, and background execution flow for batch workflows.
 */
import { useEffect, useRef } from "react";
import {
  useWorkspace,
  useWorkspaceStore,
  useService,
  useAuth,
  useWorkflow,
  useUI,
} from "../store";
import { processorEngine } from "../engine/processor-engine";
import { useDownloadActions, useQueueActions } from "./useFileUpload";
import * as runners from "../engine/execution-runner";

export const useUnifiedProcessor = () => {
  const workspaceContext = useWorkspace();
  const serviceContext = useService();
  const { refetchSession } = useAuth();
  const workflowContext = useWorkflow();
  const uiContext = useUI();

  // Destructure Workspace store values
  const {
    items,
    setItems,
    activeItemId,
    originalCanvas,
    setResultCanvas,
    isProcessing,
    setIsProcessing,
    updateActiveItem,
    updateItemOverride,
    resetItemsStatus,
    syncServiceChange,
    selectedIds,
    runToken,
    incrementRunToken,
    lastRunSteps,
    setLastRunSteps,
    activePreviewStepId,
  } = workspaceContext;

  // Destructure Workflow store values
  const {
    workflowSteps,
    addWorkflowStep,
    removeWorkflowStep,
    updateWorkflowStepOptions,
    reorderWorkflowSteps,
  } = workflowContext;

  // Destructure UI store values
  const {
    batchMode,
    setBatchMode,
    batchSettingsTarget,
    setBatchSettingsTarget,
    updateProgress,
    showToast,
  } = uiContext;

  const { currentService, getDownloadMetadata } = serviceContext;
  const queueActions = useQueueActions(workspaceContext, showToast);

  const getIsCancelled = (token) => () => useWorkspaceStore.getState().runToken !== token;

  const executeSingleItemInBatch = async (serviceId, globalOptions) => {
    setIsProcessing(true);
    const token = runToken;

    // Mark target item as processing
    const workingItems = [...useWorkspaceStore.getState().items];
    const itemIdx = workingItems.findIndex(
      (ni) => ni.id === batchSettingsTarget,
    );
    if (itemIdx !== -1) {
      workingItems[itemIdx].status = "processing";
      setItems([...workingItems]);
    }

    try {
      await runners.executeSingleItemInBatch({
        itemId: batchSettingsTarget,
        items: useWorkspaceStore.getState().items,
        setItems,
        activeItemId,
        setResultCanvas,
        serviceId,
        globalOptions,
        processorEngine,
        onProgress: updateProgress,
        isCancelled: getIsCancelled(token),
      });
      if (useWorkspaceStore.getState().runToken === token) {
        showToast("Selected image processed successfully", "success");
        refetchSession?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (useWorkspaceStore.getState().runToken === token) {
        setIsProcessing(false);
      }
    }
  };

  const executeSingleItemInWorkflow = async () => {
    setIsProcessing(true);
    const token = runToken;

    // Mark target item as processing
    const workingItems = [...useWorkspaceStore.getState().items];
    const itemIdx = workingItems.findIndex(
      (ni) => ni.id === batchSettingsTarget,
    );
    if (itemIdx !== -1) {
      workingItems[itemIdx].status = "processing";
      setItems([...workingItems]);
    }

    try {
      await runners.executeSingleItemInWorkflow({
        itemId: batchSettingsTarget,
        items: useWorkspaceStore.getState().items,
        setItems,
        activeItemId,
        setResultCanvas,
        workflowSteps,
        processorEngine,
        onProgress: updateProgress,
        isCancelled: getIsCancelled(token),
        activePreviewStepId,
      });
      if (useWorkspaceStore.getState().runToken === token) {
        showToast("Selected image workflow complete", "success");
        refetchSession?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (useWorkspaceStore.getState().runToken === token) {
        setIsProcessing(false);
      }
    }
  };

  const executeSingle = async (serviceId, options, sourceCanvas) => {
    setIsProcessing(true);
    const token = runToken;
    try {
      const result = await runners.executeSingle({
        serviceId,
        options,
        sourceCanvas,
        processorEngine,
        onProgress: updateProgress,
        setResultCanvas,
        updateActiveItem,
        isCancelled: getIsCancelled(token),
      });
      if (useWorkspaceStore.getState().runToken === token) {
        showToast("Processing complete", "success");
        refetchSession?.();
      }
      return result;
    } catch (err) {
      if (useWorkspaceStore.getState().runToken === token) {
        showToast(`Error: ${err.message}`, "error");
      }
    } finally {
      if (useWorkspaceStore.getState().runToken === token) {
        setIsProcessing(false);
      }
    }
  };

  const executeBatch = async (serviceId, options, runOptions = {}) => {
    const { forceReset = false } = runOptions;

    let currentItems = [...useWorkspaceStore.getState().items];
    if (forceReset) {
      resetItemsStatus(); // Use store action
      currentItems = useWorkspaceStore.getState().items.map((item) => ({
        ...item,
        status: "pending",
        error: null,
        progress: 0,
        resultCanvas: null,
        stepResults: {},
        serviceResults: {},
      }));
      setItems(currentItems);
    }

    const pendingItems = currentItems.filter((i) => i.status !== "done");
    if (pendingItems.length === 0) {
      return showToast("No images to process", "info");
    }

    setIsProcessing(true);
    const token = runToken;

    try {
      await runners.executeBatch({
        serviceId,
        options,
        items: currentItems,
        setItems,
        processorEngine,
        onProgress: updateProgress,
        isCancelled: getIsCancelled(token),
      });
      if (useWorkspaceStore.getState().runToken === token) {
        showToast("Batch processing complete", "success");
        refetchSession?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (useWorkspaceStore.getState().runToken === token) {
        setIsProcessing(false);
      }
    }
  };

  const executeWorkflow = async (options = {}) => {
    const { forceReset = false } = options;
    if (workflowSteps.length === 0) {
      return showToast("Add steps to your pipeline first", "warning");
    }

    const stepsSerialized = JSON.stringify(
      workflowSteps.map((s) => ({
        id: s.id,
        serviceId: s.serviceId,
        options: s.options,
      })),
    );
    const stepsChanged =
      lastRunSteps !== null &&
      lastRunSteps !== stepsSerialized;
    setLastRunSteps(stepsSerialized);

    const shouldReset = forceReset || stepsChanged;

    let currentItems = [...useWorkspaceStore.getState().items];
    if (shouldReset) {
      resetItemsStatus(); // Use store action
      currentItems = useWorkspaceStore.getState().items.map((item) => ({
        ...item,
        status: "pending",
        error: null,
        progress: 0,
        resultCanvas: null,
        stepResults: {},
        serviceResults: {},
      }));
      setItems(currentItems);
    }

    const pendingItems = currentItems.filter((i) => i.status !== "done");
    if (pendingItems.length === 0) {
      if (useWorkspaceStore.getState().items.length === 0) return showToast("No images uploaded", "info");
      return showToast("All images already processed", "info");
    }

    setIsProcessing(true);
    const token = runToken;

    try {
      await runners.executeWorkflow({
        items: currentItems,
        setItems,
        workflowSteps,
        activeItemId,
        setResultCanvas,
        processorEngine,
        onProgress: updateProgress,
        isCancelled: getIsCancelled(token),
        activePreviewStepId,
      });
      if (useWorkspaceStore.getState().runToken === token) {
        showToast("Workflow pipeline complete", "success");
        refetchSession?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (useWorkspaceStore.getState().runToken === token) {
        setIsProcessing(false);
      }
    }
  };

  const { downloadSelected, downloadAll } = useDownloadActions(
    items,
    selectedIds,
    getDownloadMetadata,
  );

  const resetProcessingState = (shouldResetItems = true) => {
    setIsProcessing(false);
    updateProgress(0, "");
    if (shouldResetItems) {
      resetItemsStatus();
    }
  };

  const cancel = () => {
    incrementRunToken();
    setIsProcessing(false);
    updateProgress(0, "Paused");
    const workingItems = [...useWorkspaceStore.getState().items];
    let changed = false;
    workingItems.forEach((item) => {
      if (item.status === "processing") {
        item.status = "pending";
        changed = true;
      }
    });
    if (changed) {
      setItems(workingItems);
    }
  };

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
    if (currentService.id !== lastServiceIdRef.current) {
      const oldServiceId = lastServiceIdRef.current;
      lastServiceIdRef.current = currentService.id;
      incrementRunToken();
      updateProgress(0, "");
      setIsProcessing(false);
      syncServiceChange(oldServiceId, currentService.id);
    }
  }, [currentService.id, incrementRunToken, syncServiceChange, updateProgress, setIsProcessing]);

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

  return {
    executeSingle,
    executeBatch,
    executeWorkflow,
    resetItemsStatus,
    cancel,
    ...queueActions,
    downloadSelected,
    downloadAll,
    items,
    selectedIds: queueActions.selectedIds,
    workflowSteps,
    addStep: addWorkflowStep,
    removeStep: removeWorkflowStep,
    updateStep: updateWorkflowStepOptions,
    reorderSteps: reorderWorkflowSteps,

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
};
