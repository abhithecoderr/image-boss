import { useCallback } from 'react';
import { loadImage, imageToCanvas } from '../core/canvas-utils';
import { useApp } from '../context/AppContext';

export const useFileIngestion = () => {
  const {
    setOriginalImage,
    setOriginalCanvas,
    setOriginalFile,
    setResultCanvas,
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
      setOriginalImage(img);
      setOriginalCanvas(imageToCanvas(img).canvas);
      setOriginalFile(file);
      setResultCanvas(null);
      showToast('Image loaded successfully!', 'success');
    } catch (err) {
      console.error('Failed to load image:', err);
      showToast('Failed to load image', 'error');
    }
  }, [setOriginalImage, setOriginalCanvas, setResultCanvas, showToast]);

  return { handleFile };
};
