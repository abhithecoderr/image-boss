import { useCallback, useRef, useEffect } from 'react';
import { useWorkspace, useSegmentation } from '../store';

/* 
 useMaskEditor:
 Direct canvas overlay brush tool.
 Enables users to paint directly on the result mask canvas to erase or restore mask segments manually.
*/
export const useMaskEditor = (resRef) => {
  const {
    originalCanvas,
    resultCanvas,
    setResultCanvas
  } = useWorkspace();
  const editing = useSegmentation((state) => state.editing);
  const setEditing = useSegmentation((state) => state.setEditing);

  // Hidden offscreen canvas buffer keeping track of the pure transparency mask image
  const maskCanvasRef = useRef(null);

  // Initialize offscreen mask buffer whenever result canvas modifications arrive
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

  // Redraws the composite (Original Canvas + Mask Buffer Overlay) onto the viewport display canvas
  const updateDisplay = useCallback(() => {
    if (!resRef.current || !maskCanvasRef.current || !originalCanvas) return;

    const displayCanvas = resRef.current;
    const mask = maskCanvasRef.current;
    const ctx = displayCanvas.getContext('2d');

    displayCanvas.width = mask.width;
    displayCanvas.height = mask.height;
    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

    // Composite: Destination-in transparency mask cutouts
    ctx.drawImage(originalCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }, [originalCanvas, resRef]);

  // Saves/Flushes the painted mask canvas back into the global workspace result context
  const bakeMask = useCallback(() => {
    if (!maskCanvasRef.current || !originalCanvas) return;

    const mask = maskCanvasRef.current;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = mask.width;
    finalCanvas.height = mask.height;
    const ctx = finalCanvas.getContext('2d');

    ctx.drawImage(originalCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    setResultCanvas(finalCanvas);
  }, [originalCanvas, setResultCanvas]);

  // Draws brush strokes at coordinates (utilizing canvas coordinate scaling offsets)
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

    // Erase draws transparency cutouts, Restore draws original image pixels back
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

  // Drawing event wrappers supporting mouse drag painting loops
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
