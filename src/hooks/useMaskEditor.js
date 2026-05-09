import { useCallback, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const useMaskEditor = (resRef) => {
  const {
    editing,
    setEditing,
    originalCanvas,
    resultCanvas,
    setResultCanvas,
    currentService
  } = useApp();

  const maskCanvasRef = useRef(null);

  // Initialize mask canvas when result changes
  useEffect(() => {
    if (resultCanvas) {
      const isValid = 
        resultCanvas instanceof HTMLCanvasElement ||
        resultCanvas instanceof OffscreenCanvas ||
        resultCanvas instanceof ImageBitmap;
        
      if (!isValid) return;

      let canvas = maskCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        maskCanvasRef.current = canvas;
      }
      canvas.width = resultCanvas.width;
      canvas.height = resultCanvas.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(resultCanvas, 0, 0);
    }
  }, [resultCanvas]);

  const updateDisplay = useCallback(() => {
    if (!resRef.current || !maskCanvasRef.current || !originalCanvas) return;

    const displayCanvas = resRef.current;
    const mask = maskCanvasRef.current;
    const ctx = displayCanvas.getContext('2d');

    displayCanvas.width = mask.width;
    displayCanvas.height = mask.height;
    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

    if (currentService.id === 'blur' ||
        currentService.id === 'upscaling' ||
        currentService.id === 'line-art' ||
        currentService.id === 'object-segmentation') {
      ctx.drawImage(mask, 0, 0);
    } else {
      // Background removal mode: composite
      ctx.drawImage(originalCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Also update the global state periodically or on end
    // For now, we'll sync it to a state-managed canvas if needed for download
  }, [originalCanvas, currentService, resRef]);

  const bakeMask = useCallback(() => {
    if (!maskCanvasRef.current || !originalCanvas) return;

    const mask = maskCanvasRef.current;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = mask.width;
    finalCanvas.height = mask.height;
    const ctx = finalCanvas.getContext('2d');

    if (currentService.id === 'blur' ||
        currentService.id === 'upscaling' ||
        currentService.id === 'line-art' ||
        currentService.id === 'object-segmentation') {
      ctx.drawImage(mask, 0, 0);
    } else {
      // Background removal mode: composite
      ctx.drawImage(originalCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    setResultCanvas(finalCanvas);
  }, [originalCanvas, currentService, setResultCanvas]);

  const drawAt = useCallback((clientX, clientY) => {
    if (!resRef.current || !maskCanvasRef.current || editing.activeTool === 'none') return;

    const canvas = resRef.current;
    const maskCtx = maskCanvasRef.current.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = maskCanvasRef.current.width / rect.width;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleX;
    const size = editing.brushSize * scaleX;

    maskCtx.save();
    maskCtx.beginPath();
    maskCtx.arc(x, y, size / 2, 0, Math.PI * 2);

    if (editing.activeTool === 'erase') {
      maskCtx.globalCompositeOperation = 'destination-out';
      maskCtx.fill();
    } else if (editing.activeTool === 'restore') {
      maskCtx.globalCompositeOperation = 'source-over';
      const pattern = maskCtx.createPattern(originalCanvas, 'no-repeat');
      maskCtx.fillStyle = pattern;
      maskCtx.fill();
    }
    maskCtx.restore();
    updateDisplay();
  }, [editing.activeTool, editing.brushSize, originalCanvas, updateDisplay, resRef]);

  const startDrawing = useCallback((e) => {
    setEditing(prev => ({ ...prev, isDrawing: true }));
    drawAt(e.clientX, e.clientY);
  }, [setEditing, drawAt]);

  const moveDrawing = useCallback((e) => {
    if (editing.isDrawing) {
      drawAt(e.clientX, e.clientY);
    }
  }, [editing.isDrawing, drawAt]);

  const endDrawing = useCallback(() => {
    setEditing(prev => ({ ...prev, isDrawing: false }));
    // Sync final mask back to AppContext for saving/downloading
    if (maskCanvasRef.current) {
      bakeMask();
    }
  }, [setEditing, bakeMask]);

  return {
    startDrawing,
    moveDrawing,
    endDrawing,
    activeTool: editing.activeTool,
    brushSize: editing.brushSize
  };
};
