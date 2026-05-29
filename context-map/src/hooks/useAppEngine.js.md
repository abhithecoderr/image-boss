**Role**

Main hook which provides the current operation mode, engine object and an execute function to help the process button call it without worrying about the mode.

Also maintains awareness about the items queue in batch mode and clears the list for a non batch mode service when selected.


**Structure**

*State retrieval*

```js
const { originalCanvas, items, activeItemId, selectedIds, batchMode, setBatchMode } = useWorkspace();
  const { currentService } = useService();
  const unified = useUnifiedProcessor();
```


*Universal Execute function*

```js
 const execute = useCallback(async (options = {}, runOptions = {}) => {
    switch (activeMode) {
      case OPERATION_MODE.WORKFLOW:
        return unified.executeWorkflow(runOptions);
      case OPERATION_MODE.BATCH:
        return unified.executeBatch(currentService.id, options, runOptions);
      default:
        return unified.executeSingle(currentService.id, options, originalCanvas);
    }
  }, [activeMode, currentService.id, originalCanvas, unified]);
```


*Engine object*

```js
const { items: _items, workflowSteps: _steps, ...methods } = unified;

  const engine = {
    ...methods,
    items,
    selectedIds,
    mode: activeMode.toLowerCase(),
    batchAvailable,
    setMode: setBatchMode,
    activeItemId: calculateActiveItemId(activeMode, items, activeItemId),
    doneCount: calculateDoneCount(activeMode, items),
    processAll: (options) => execute(options),
    rerunAll: (options) => execute(options, { forceReset: true }),
  };

  return {
    mode: activeMode,
    engine,
    execute,
    unified
  };
};
```