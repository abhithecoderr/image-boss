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
      (prog, msg) => {
        if (isCancelled()) return;
        onProgress(prog, msg);
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
        (prog, msg) => {
          if (isCancelled()) return;
          onProgress(prog, `[${i + 1}/${pendingItems.length}] ${msg}`);
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
}) => {
  const pendingItems = items.filter((i) => i.status !== "done");
  if (pendingItems.length === 0) return;

  const workingItems = [...items];

  try {
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

        const prefix = `Step ${j + 1}/${workflowSteps.length} [Image ${i + 1}/${pendingItems.length}]: `;

        try {
          const itemOverrides = item.settingsOverrides?.[step.id] || {};
          const activeOptions = { ...step.options, ...itemOverrides };

          const result = await processItem(
            item,
            step.serviceId,
            activeOptions,
            processorEngine,
            (prog, msg) => {
              if (isCancelled()) return;
              onProgress(prog, `${prefix}${msg}`);
            },
            currentCanvas,
          );

          if (result) {
            workingItems[itemIdx].stepResults = {
              ...workingItems[itemIdx].stepResults,
              [step.id]: { resultCanvas: result, status: "done" },
            };

            if (j === workflowSteps.length - 1) {
              workingItems[itemIdx] = {
                ...workingItems[itemIdx],
                resultCanvas: result,
                status: "done",
              };

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
      (prog, msg) => {
        if (isCancelled()) return;
        onProgress(prog, `[Selective] ${msg}`);
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

  try {
    for (let j = 0; j < workflowSteps.length; j++) {
      if (isCancelled()) break;
      const step = workflowSteps[j];
      const prefix = `Step ${j + 1}/${workflowSteps.length} [Selective]: `;

      const itemOverrides = item.settingsOverrides?.[step.id] || {};
      const activeOptions = { ...step.options, ...itemOverrides };

      const result = await processItem(
        item,
        step.serviceId,
        activeOptions,
        processorEngine,
        (prog, msg) => {
          if (isCancelled()) return;
          onProgress(prog, `${prefix}${msg}`);
        },
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

    if (isCancelled()) return;

    workingItems[itemIdx] = {
      ...workingItems[itemIdx],
      resultCanvas: currentCanvas,
      status: "done",
    };

    if (itemId === activeItemId) {
      setResultCanvas(currentCanvas);
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
