**Purpose**:
It runs the relevant processor for the given ai service, by accepting the particular options for that ai service, and sets the final result canvas as the one returned.

**Code Structure**:

*Imports and State*

```js
import { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';

export const useProcessor = () => {
  const {
    currentService,
    originalCanvas,
    setResultCanvas,
    setSegmentationResult,
    setIsProcessing,
    updateProgress,
    showToast
  } = useApp();
  ```

  *loadProcessor function to lazy load ai module on demand*

    Used internally within the hook by process function.

  ```js
  const loadProcessor = useCallback(async (serviceId) => {
    try {
      // Framework-agnostic lazy load from the services folder
      const module = await import(`../services/${serviceId}/processor.js`);
      return module.default || module;
    } catch (err) {
      console.error(`Failed to load processor for ${serviceId}:`, err);
      throw err;
    }
  }, []);
  ```

*process function*

  Resets the results to null when new processing begins

  ```js
  const process = useCallback(async (options = {}) => {
    if (!originalCanvas || !currentService) return;

    // Reset results before starting new process (e.g. on model switch)
    setResultCanvas(null);
    setSegmentationResult(null);

    setIsProcessing(true);
    updateProgress(0, 'Initializing...');
  ```


  Calls the ai processor's process function, supplies it with original canvas and options, validates the result recieved and updates global state

  ```js
  const result = await processorRef.current.process(
        originalCanvas,
        options,
        (prog, msg) => updateProgress(prog, msg)
      );

      // Handle different result formats (Canvas, Object with Canvas, etc.)
      const finalCanvas = result.canvas || result;

      // Only set result if it's actually a canvas-like object
      const isValidCanvas = finalCanvas &&
        (finalCanvas instanceof HTMLCanvasElement ||
         finalCanvas instanceof OffscreenCanvas ||
         finalCanvas instanceof ImageBitmap);

      if (isValidCanvas) {
        setResultCanvas(finalCanvas);
      }
  ```