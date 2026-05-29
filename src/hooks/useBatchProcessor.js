import { useCallback } from 'react';

/* 
 useBatchProcessor:
 Execution strategy for batch processing images.
 Loops through multiple queued images and processes each sequentially using a single AI service.
*/
export const useBatchProcessor = (workspace, ui, processItem, _resetItems) => {
  // Destructure workspace state controllers and UI notification helpers
  const { items, setItems, setIsProcessing } = workspace;
  const { showToast } = ui;

  /* 
   executeBatch:
   Loops through pending batch items, updates progress states, runs core processing per image,
   captures results or errors, and locks/releases UI progress indicators globally.
  */
  const executeBatch = useCallback(async (serviceId, options, runOptions = {}) => {
    const { forceReset = false } = runOptions;

    // Step 1: Initialize current items queue (resetting status if rerun/reset is requested)
    let currentItems = [...items];
    if (forceReset) {
      currentItems = _resetItems(currentItems);
      setItems(currentItems);
    }

    // Step 2: Extract only items that still need to be processed
    const pendingItems = currentItems.filter(i => i.status !== 'done');
    if (pendingItems.length === 0) return showToast('No images to process', 'info');

    setIsProcessing(true); // Lock workspace viewport
    const workingItems = [...currentItems];

    // Step 3: Run sequentially through the pending items
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const itemIdx = workingItems.findIndex(ni => ni.id === item.id);

      // Mark the active item status as 'processing'
      workingItems[itemIdx].status = 'processing';
      setItems([...workingItems]);

      try {
        // Execute the processing helper with progress prefix identifiers (e.g. "[1/5] Processing...")
        const result = await processItem(item, serviceId, options, `[${i + 1}/${pendingItems.length}] `);
        workingItems[itemIdx].resultCanvas = result;
        workingItems[itemIdx].status = 'done';
      } catch (err) {
        workingItems[itemIdx].status = 'error';
        workingItems[itemIdx].error = err.message;
      }

      // Commit local item changes back to global list
      setItems([...workingItems]);
    }

    setIsProcessing(false); // Unlock workspace viewport
    showToast('Batch processing complete', 'success');
  }, [items, setItems, setIsProcessing, showToast, processItem, _resetItems]);

  return { executeBatch };
};
