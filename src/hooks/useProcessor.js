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

  const processorRef = useRef(null);

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

  const process = useCallback(async (options = {}) => {
    if (!originalCanvas || !currentService) return;

    // Reset results before starting new process (e.g. on model switch)
    setResultCanvas(null);
    setSegmentationResult(null);

    setIsProcessing(true);
    updateProgress(0, 'Initializing...');

    try {
      if (!processorRef.current || processorRef.current.id !== currentService.id) {
        // Dispose old if needed
        if (processorRef.current?.dispose) {
          processorRef.current.dispose();
        }
        processorRef.current = await loadProcessor(currentService.id);
        processorRef.current.id = currentService.id;
      }

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

      showToast('Processing complete!', 'success');
      return result;
    } catch (err) {
      console.error('Processing failed:', err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [originalCanvas, currentService, loadProcessor, setIsProcessing, updateProgress, setResultCanvas, showToast]);

  return { process };
};
