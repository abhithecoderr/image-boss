import { useCallback } from 'react';
import { processorEngine } from '../core/processor-engine';

/* 
 useSingleProcessor:
 Execution strategy for processing a single image.
 Acts as a focused bridge between the pure processing engine and the active viewport state.
*/
export const useSingleProcessor = (workspace, ui) => {
  // Destructure workspace and UI setters/getters
  const { setResultCanvas, setIsProcessing } = workspace;
  const { updateProgress, showToast } = ui;

  /* 
   executeSingle:
   Runs the processing engine on a single source canvas using the active service parameters,
   updates the global processing state, and binds the final output canvas to the editor results.
  */
  const executeSingle = useCallback(async (serviceId, options, sourceCanvas) => {
    setIsProcessing(true); // Lock the UI viewport by marking processing in-progress
    try {
      // Call the pure processing engine with optional progress report listeners
      const result = await processorEngine.process(
        serviceId,
        sourceCanvas,
        options,
        (prog, msg) => updateProgress(prog, msg)
      );

      // Extract the output canvas or image-data variant
      const canvas = result.canvas || result;
      const isValid = canvas && (
        canvas instanceof HTMLCanvasElement ||
        canvas instanceof OffscreenCanvas ||
        canvas instanceof ImageBitmap
      );

      // If output is valid, sync it back to the editor result view
      if (isValid) {
        setResultCanvas(canvas);
        showToast('Processing complete', 'success');
      }

      return result;
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false); // Release UI lock
    }
  }, [setIsProcessing, updateProgress, setResultCanvas, showToast]);

  return { executeSingle };
};
