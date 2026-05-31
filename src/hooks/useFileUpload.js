import { useCallback } from 'react';
import { loadImage, imageToCanvas, canvasToThumbURL } from '../core/canvas-utils';
import { useWorkspace, useService, useUI } from '../context/AppContext';
import { createBatchItem } from '../core/BatchItem';
import { APP_CONFIG } from '../config/app';

/* 
 useFileUpload:
 Coordinates uploading a new file in single-image editing viewport modes.
 Validates file constraints, generates canvases and caching thumbnails, and flushes past service states.
*/
export const useFileUpload = () => {
  const {
    setOriginalCanvas,
    setOriginalFile,
    setResultCanvas,
    setItems,
    setActiveItemId
  } = useWorkspace();
  const { resetServiceState } = useService();
  const { showToast } = useUI();

  // Receives a raw File, checks size parameters, draws it onto an image element and canvas, and sets up state queues.
  const handleFile = useCallback(async (file) => {
    if (file.size > APP_CONFIG.maxFileSize) {
      showToast('File too large. Maximum size is 5MB.', 'error');
      return;
    }

    try {
      // Decode raw file bytes into an HTMLImageElement and render onto canvas buffers
      const img = await loadImage(file);
      const { canvas } = imageToCanvas(img);
      
      // Reset single-service and active canvas viewport states
      setOriginalCanvas(canvas);
      showToast('Loading image details...');
      setOriginalFile(file);
      setResultCanvas(null);
      resetServiceState();

      // Reset and bind the multi-service queue (batch/workflow state lists) to this single loaded file
      const item = createBatchItem({
        name: file.name,
        file: file,
        sourceCanvas: canvas
      });
      item.thumbnailUrl = canvasToThumbURL(canvas);
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
