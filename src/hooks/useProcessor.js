import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { processorEngine } from '../core/processor-engine';

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

  const process = useCallback(async (options = {}) => {
    if (!originalCanvas || !currentService) return;

    const isPostProcess = options._postProcess === true;

    if (!isPostProcess) {
      // Reset results before starting new process
      setResultCanvas(null);
      setSegmentationResult(null);
      setIsProcessing(true);
      updateProgress(0, 'Initializing...');
    }

    try {
      const result = await processorEngine.process(
        currentService.id,
        originalCanvas,
        options,
        isPostProcess ? undefined : (prog, msg) => updateProgress(prog, msg)
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

      if (!isPostProcess) {
        showToast('Processing complete!', 'success');
      }
      return result;
    } catch (err) {
      console.error('Processing failed:', err);
      if (!isPostProcess) {
        showToast(`Error: ${err.message}`, 'error');
      }
    } finally {
      if (!isPostProcess) {
        setIsProcessing(false);
      }
    }
  }, [originalCanvas, currentService, setIsProcessing, updateProgress, setResultCanvas, setSegmentationResult, showToast]);

  return { process };
};

