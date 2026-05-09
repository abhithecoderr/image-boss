import { useCallback } from 'react';
import { loadImage, imageToCanvas } from '../core/canvas-utils';
import { useApp } from '../context/AppContext';
import { ProcessingItem } from '../core/ProcessingItem';

export const useFileIngestion = () => {
  const {
    setOriginalCanvas,
    setOriginalFile,
    setResultCanvas,
    resetServiceState,
    setItems,
    setActiveItemId,
    showToast
  } = useApp();

  const handleFile = useCallback(async (file) => {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast('File too large. Maximum size is 5MB.', 'error');
      return;
    }

    try {
      const img = await loadImage(file);
      const { canvas } = imageToCanvas(img);
      
      // Update single-service state
      setOriginalCanvas(canvas);
      setOriginalFile(file);
      setResultCanvas(null);
      resetServiceState();

      // Update multi-service (batch/workflow) state
      const item = new ProcessingItem({
        name: file.name,
        file: file,
        sourceCanvas: canvas
      });
      setItems([item]);
      setActiveItemId(item.id);

      showToast('Image loaded successfully!', 'success');
    } catch (err) {
      console.error('Failed to load image:', err);
      showToast('Failed to load image', 'error');
    }
  }, [setOriginalCanvas, setOriginalFile, setResultCanvas, resetServiceState, setItems, setActiveItemId, showToast]);

  return { handleFile };
};
