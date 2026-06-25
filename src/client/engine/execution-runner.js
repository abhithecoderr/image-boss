/*
 * Stateless runner functions containing low-level async loops for single, batch, and workflow service executions.
 */

export const processItem = async (
  item,
  serviceId,
  options,
  processorEngine,
  onProgress,
  overrideCanvas = null,
) => {
  const source = overrideCanvas || item.sourceCanvas;
  if (!source) return null;

  try {
    const result = await processorEngine.process(
      serviceId,
      source,
      options,
      onProgress,
    );

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

export const executeSingle = async ({
  serviceId,
  options,
  sourceCanvas,
  processorEngine,
  onProgress,
  setResultCanvas,
  updateActiveItem,
  isCancelled,
}) => {
  try {
    const result = await processorEngine.process(
      serviceId,
      sourceCanvas,
      options,
      (prog) => {
        if (isCancelled()) return;
        onProgress(prog);
      },
    );

    if (isCancelled()) return result;

    const canvas = result.canvas || result;
    const isValid =
      canvas &&
      (canvas instanceof HTMLCanvasElement ||
        canvas instanceof OffscreenCanvas ||
        canvas instanceof ImageBitmap);

    if (isValid) {
      setResultCanvas(canvas);
      updateActiveItem({ status: "done", error: null, resultCanvas: canvas });
    }
    return result;
  } catch (err) {
    if (isCancelled()) return;
    setResultCanvas(null);
    updateActiveItem({ status: "error", error: err.message });
    throw err;
  }
};

export const executeBatch = async ({
  serviceId,
  options,
  items,
  setItems,
  processorEngine,
  onProgress,
  isCancelled,
}) => {
  const pendingItems = items.filter((i) => i.status !== "done");
  if (pendingItems.length === 0) return;

  const workingItems = [...items];

  for (let i = 0; i < pendingItems.length; i++) {
    if (isCancelled()) break;

    const item = pendingItems[i];
    const itemIdx = workingItems.findIndex((ni) => ni.id === item.id);

    workingItems[itemIdx] = {
      ...workingItems[itemIdx],
      status: "processing",
    };
    setItems([...workingItems]);

    try {
      const itemOverrides = item.settingsOverrides?.[serviceId] || {};
      const activeOptions = { ...options, ...itemOverrides };

      const result = await processItem(
        item,
        serviceId,
        activeOptions,
        processorEngine,
        (prog) => {
          if (isCancelled()) return;
          let payload = prog;
          if (typeof prog !== "object" || prog === null) {
            payload = {
              stage: "processing",
              percent: typeof prog === "number" ? Math.round(prog * 100) : 0,
              message: "",
              details: {}
            };
          } else {
            payload = { ...payload, details: { ...payload.details } };
          }
          payload.details.itemIndex = i + 1;
          payload.details.itemTotal = pendingItems.length;
          onProgress(payload);
        },
      );

      if (isCancelled()) break;

      workingItems[itemIdx] = {
        ...workingItems[itemIdx],
        resultCanvas: result,
        status: "done",
      };
    } catch (err) {
      if (isCancelled()) break;
      workingItems[itemIdx] = {
        ...workingItems[itemIdx],
        status: "error",
        error: err.message,
      };
    }

    setItems([...workingItems]);
  }
};

export const executeWorkflow = async ({
  items,
  setItems,
  workflowSteps,
  activeItemId,
  setResultCanvas,
  processorEngine,
  onProgress,
  isCancelled,
  activePreviewStepId = null,
}) => {
  const pendingItems = items.filter((i) => i.status !== "done");
  if (pendingItems.length === 0) return;

  const workingItems = [...items];

  try {
    const inputChangedMap = {};

    for (let j = 0; j < workflowSteps.length; j++) {
      if (isCancelled()) break;
      const step = workflowSteps[j];

      for (let i = 0; i < pendingItems.length; i++) {
        if (isCancelled()) break;
        const item = pendingItems[i];
        const itemIdx = workingItems.findIndex((ni) => ni.id === item.id);

        if (workingItems[itemIdx].status === "error") continue;

        workingItems[itemIdx] = {
          ...workingItems[itemIdx],
          status: "processing",
        };
        setItems([...workingItems]);

        const previousStep = j > 0 ? workflowSteps[j - 1] : null;
        const currentCanvas = previousStep
          ? workingItems[itemIdx].stepResults?.[previousStep.id]?.resultCanvas
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

        try {
          const itemOverrides = item.settingsOverrides?.[step.id] || {};
          const activeOptions = { ...step.options, ...itemOverrides };
          const activeOptionsStr = JSON.stringify(activeOptions);

          const cachedStep = workingItems[itemIdx].stepResults?.[step.id];
          const canReuse =
            !inputChangedMap[item.id] &&
            cachedStep &&
            cachedStep.status === "done" &&
            cachedStep.resultCanvas &&
            cachedStep.optionsStr === activeOptionsStr;

          let result;
          if (canReuse) {
            result = cachedStep.resultCanvas;
            onProgress({
              stage: "processing",
              percent: 100,
              message: "Reusing cached step result",
              details: {
                itemIndex: i + 1,
                itemTotal: pendingItems.length,
                stepIndex: j + 1,
                stepTotal: workflowSteps.length,
              },
            });
          } else {
            inputChangedMap[item.id] = true;
            result = await processItem(
              item,
              step.serviceId,
              activeOptions,
              processorEngine,
              (prog) => {
                if (isCancelled()) return;
                let payload = prog;
                if (typeof prog !== "object" || prog === null) {
                  payload = {
                    stage: "processing",
                    percent: typeof prog === "number" ? Math.round(prog * 100) : 0,
                    message: "",
                    details: {}
                  };
                } else {
                  payload = { ...payload, details: { ...payload.details } };
                }
                payload.details.itemIndex = i + 1;
                payload.details.itemTotal = pendingItems.length;
                payload.details.stepIndex = j + 1;
                payload.details.stepTotal = workflowSteps.length;
                onProgress(payload);
              },
              currentCanvas,
            );
          }

          if (result) {
            workingItems[itemIdx].stepResults = {
              ...workingItems[itemIdx].stepResults,
              [step.id]: { resultCanvas: result, status: "done", optionsStr: activeOptionsStr },
            };
            setItems([...workingItems]);

            if (item.id === activeItemId && activePreviewStepId === step.id) {
              setResultCanvas(result);
            }

            if (j === workflowSteps.length - 1) {
              workingItems[itemIdx] = {
                ...workingItems[itemIdx],
                resultCanvas: result,
                status: "done",
              };

              if (item.id === activeItemId) {
                if (!activePreviewStepId) {
                  setResultCanvas(result);
                } else if (workingItems[itemIdx].stepResults?.[activePreviewStepId]?.resultCanvas) {
                  setResultCanvas(workingItems[itemIdx].stepResults[activePreviewStepId].resultCanvas);
                }
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
    console.error("Workflow execution runner failed:", globalErr);
    throw globalErr;
  }
};

export const executeSingleItemInBatch = async ({
  itemId,
  items,
  setItems,
  activeItemId,
  setResultCanvas,
  serviceId,
  globalOptions,
  processorEngine,
  onProgress,
  isCancelled,
}) => {
  const item = items.find((i) => i.id === itemId);
  if (!item) return;

  const workingItems = [...items];
  const itemIdx = workingItems.findIndex((ni) => ni.id === itemId);

  workingItems[itemIdx] = {
    ...workingItems[itemIdx],
    status: "processing",
  };
  setItems([...workingItems]);

  try {
    const itemOverrides = item.settingsOverrides?.[serviceId] || {};
    const activeOptions = { ...globalOptions, ...itemOverrides };

    const result = await processItem(
      item,
      serviceId,
      activeOptions,
      processorEngine,
      (prog) => {
        if (isCancelled()) return;
        let payload = prog;
        if (typeof prog !== "object" || prog === null) {
          payload = {
            stage: "processing",
            percent: typeof prog === "number" ? Math.round(prog * 100) : 0,
            message: "",
            details: {}
          };
        } else {
          payload = { ...payload, details: { ...payload.details } };
        }
        if (payload.message && !payload.message.startsWith("[Selective]")) {
          payload.message = `[Selective] ${payload.message}`;
        }
        onProgress(payload);
      },
    );

    if (isCancelled()) return;

    workingItems[itemIdx] = {
      ...workingItems[itemIdx],
      resultCanvas: result,
      status: "done",
    };

    if (itemId === activeItemId) {
      setResultCanvas(result);
    }
  } catch (err) {
    if (isCancelled()) return;
    workingItems[itemIdx] = {
      ...workingItems[itemIdx],
      status: "error",
      error: err.message,
    };
  }

  setItems([...workingItems]);
};

export const executeSingleItemInWorkflow = async ({
  itemId,
  items,
  setItems,
  activeItemId,
  setResultCanvas,
  workflowSteps,
  processorEngine,
  onProgress,
  isCancelled,
  activePreviewStepId = null,
}) => {
  const item = items.find((i) => i.id === itemId);
  if (!item) return;

  const workingItems = [...items];
  const itemIdx = workingItems.findIndex((ni) => ni.id === itemId);

  workingItems[itemIdx] = {
    ...workingItems[itemIdx],
    status: "processing",
  };
  setItems([...workingItems]);

  let currentCanvas = item.sourceCanvas;
  let inputChanged = false;

  try {
    for (let j = 0; j < workflowSteps.length; j++) {
      if (isCancelled()) break;
      const step = workflowSteps[j];

      const itemOverrides = item.settingsOverrides?.[step.id] || {};
      const activeOptions = { ...step.options, ...itemOverrides };
      const activeOptionsStr = JSON.stringify(activeOptions);

      const cachedStep = workingItems[itemIdx].stepResults?.[step.id];
      const canReuse =
        !inputChanged &&
        cachedStep &&
        cachedStep.status === "done" &&
        cachedStep.resultCanvas &&
        cachedStep.optionsStr === activeOptionsStr;

      let result;
      if (canReuse) {
        result = cachedStep.resultCanvas;
        currentCanvas = result;
        onProgress({
          stage: "processing",
          percent: 100,
          message: "Reusing cached step result",
          details: {
            stepIndex: j + 1,
            stepTotal: workflowSteps.length,
          },
        });
      } else {
        inputChanged = true;
        result = await processItem(
          item,
          step.serviceId,
          activeOptions,
          processorEngine,
          (prog) => {
            if (isCancelled()) return;
            let payload = prog;
            if (typeof prog !== "object" || prog === null) {
              payload = {
                stage: "processing",
                percent: typeof prog === "number" ? Math.round(prog * 100) : 0,
                message: "",
                details: {}
              };
            } else {
              payload = { ...payload, details: { ...payload.details } };
            }
            payload.details.stepIndex = j + 1;
            payload.details.stepTotal = workflowSteps.length;
            if (payload.message && !payload.message.startsWith("[Selective]")) {
              payload.message = `[Selective] ${payload.message}`;
            }
            onProgress(payload);
          },
          currentCanvas,
        );

        if (result) {
          currentCanvas = result;
          workingItems[itemIdx].stepResults = {
            ...workingItems[itemIdx].stepResults,
            [step.id]: { resultCanvas: result, status: "done", optionsStr: activeOptionsStr },
          };
          setItems([...workingItems]);

          if (itemId === activeItemId && activePreviewStepId === step.id) {
            setResultCanvas(result);
          }
        } else {
          throw new Error("Workflow step returned empty canvas");
        }
      }
    }

    if (isCancelled()) return;

    workingItems[itemIdx] = {
      ...workingItems[itemIdx],
      resultCanvas: currentCanvas,
      status: "done",
    };

    if (itemId === activeItemId) {
      if (!activePreviewStepId) {
        setResultCanvas(currentCanvas);
      } else if (workingItems[itemIdx].stepResults?.[activePreviewStepId]?.resultCanvas) {
        setResultCanvas(workingItems[itemIdx].stepResults[activePreviewStepId].resultCanvas);
      }
    }
  } catch (err) {
    if (isCancelled()) return;
    workingItems[itemIdx] = {
      ...workingItems[itemIdx],
      status: "error",
      error: err.message,
    };
  }

  setItems([...workingItems]);
};
