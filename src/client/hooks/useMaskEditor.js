/*
 * Direct canvas overlay brush tool. Enables users to paint directly on the result mask canvas to erase or restore mask segments manually.
 */
import { useRef, useEffect } from 'react';
import { useWorkspace, useSegmentation } from '../store';

export const useMaskEditor = (resRef) => {
  const {
    originalCanvas,
    resultCanvas,
    setResultCanvas,
    workflowSteps,
    items,
    activeItemId
  } = useWorkspace();
  const editing = useSegmentation((state) => state.editing);
  const setEditing = useSegmentation((state) => state.setEditing);

  // Compute the base canvas (either the original canvas, or the result of the previous step in a workflow)
  let baseCanvas = originalCanvas;
  const activeStepId = editing.activeStepId;
  
  if (activeStepId && workflowSteps.length > 0) {
    const activeItem = items.find((i) => i.id === activeItemId);
    if (activeItem) {
      const idx = workflowSteps.findIndex((s) => s.id === activeStepId);
      if (idx > 0) {
        const previousStep = workflowSteps[idx - 1];
        baseCanvas = activeItem.stepResults?.[previousStep.id]?.resultCanvas || originalCanvas;
      }
    }
  }

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

  // Redraws the composite (Base Canvas + Mask Buffer Overlay) onto the viewport display canvas
  const updateDisplay = () => {
    if (!resRef.current || !maskCanvasRef.current || !baseCanvas) return;

    const displayCanvas = resRef.current;
    const mask = maskCanvasRef.current;
    const ctx = displayCanvas.getContext('2d');

    displayCanvas.width = mask.width;
    displayCanvas.height = mask.height;
    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

    // Composite: Destination-in transparency mask cutouts
    ctx.drawImage(baseCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  };

  // Saves/Flushes the painted mask canvas back into the global workspace result context
  const bakeMask = () => {
    if (!maskCanvasRef.current || !baseCanvas) return;

    const mask = maskCanvasRef.current;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = mask.width;
    finalCanvas.height = mask.height;
    const ctx = finalCanvas.getContext('2d');

    ctx.drawImage(baseCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    setResultCanvas(finalCanvas, activeStepId || null);
  };

  // Normalize pointer coords from either a MouseEvent or a TouchEvent so the
  // same draw handlers work for mouse drag and touch drag.
  const getCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    // touchend has no active touches, but we don't need coords there anyway.
    return { x: e.clientX, y: e.clientY };
  };

  // Draws brush strokes at coordinates (utilizing canvas coordinate scaling offsets)
  const drawAt = (clientX, clientY) => {
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

    // Erase draws transparency cutouts, Restore draws original/base image pixels back
    if (editing.activeTool === 'erase') {
      maskCtx.globalCompositeOperation = 'destination-out';
      maskCtx.fill();
    } else if (editing.activeTool === 'restore') {
      maskCtx.globalCompositeOperation = 'source-over';
      const pattern = maskCtx.createPattern(baseCanvas, 'no-repeat');
      maskCtx.fillStyle = pattern;
      maskCtx.fill();
    }
    maskCtx.restore();
    updateDisplay();
  };

  // Drawing event wrappers supporting mouse drag painting loops
  const startDrawing = (e) => {
    setEditing(prev => ({ ...prev, isDrawing: true }));
    const { x, y } = getCoords(e);
    drawAt(x, y);
  };

  const moveDrawing = (e) => {
    if (editing.isDrawing) {
      const { x, y } = getCoords(e);
      drawAt(x, y);
    }
  };

  const endDrawing = () => {
    setEditing(prev => ({ ...prev, isDrawing: false }));
    if (maskCanvasRef.current) {
      bakeMask();
    }
  };

  return {
    startDrawing,
    moveDrawing,
    endDrawing,
    activeTool: editing.activeTool,
    brushSize: editing.brushSize
  };
};
