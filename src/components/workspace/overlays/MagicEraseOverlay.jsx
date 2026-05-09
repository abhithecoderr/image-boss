import { useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';

const MagicEraseOverlay = ({ srcRef }) => {
  const { currentService, serviceSettings } = useApp();
  const overlayRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Get settings
  const settings = serviceSettings['magic-erase'] || {};
  const brushRadius = settings.radius || 20;

  // Sync overlay position with original canvas
  useEffect(() => {
    const sync = () => {
      if (!overlayRef.current || !srcRef.current) return;
      const canvas = srcRef.current;
      const overlay = overlayRef.current;

      overlay.style.width = `${canvas.offsetWidth}px`;
      overlay.style.height = `${canvas.offsetHeight}px`;
      overlay.style.left = `${canvas.offsetLeft}px`;
      overlay.style.top = `${canvas.offsetTop}px`;

      // Sync brush canvas dimensions to match source image
      if (canvasRef.current) {
        if (canvasRef.current.width !== (canvas.width || canvas.offsetWidth)) {
            canvasRef.current.width = canvas.width || canvas.offsetWidth;
            canvasRef.current.height = canvas.height || canvas.offsetHeight;

            // Fill mask initially with black (0 = keep)
            const ctx = canvasRef.current.getContext('2d');
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    if (srcRef.current) ro.observe(srcRef.current);
    window.addEventListener('resize', sync);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [srcRef, currentService]);

  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const drawBrush = useCallback((x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Convert brush size back relative to actual canvas resolution vs screen size
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const scaledBrush = brushRadius * scale;

    ctx.globalCompositeOperation = 'source-over';
    // Draw white for the mask (255 = erase)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, scaledBrush / 2, 0, Math.PI * 2);
    ctx.fill();
  }, [brushRadius]);

  const handleMouseDown = useCallback((e) => {
    if (currentService?.id !== 'magic-erase') return;

    if (e.button === 0) { // Left-click
        isDrawingRef.current = true;
        const coords = getCanvasCoords(e);
        if (coords) drawBrush(coords.x, coords.y);
    }
  }, [currentService, getCanvasCoords, drawBrush]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawingRef.current) return;
    const coords = getCanvasCoords(e);
    if (coords) drawBrush(coords.x, coords.y);
  }, [getCanvasCoords, drawBrush]);

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  const clearMask = useCallback(() => {
     if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
     }
  }, []);

  // Cleanup: listen for mouseup on window
  useEffect(() => {
    const up = () => { isDrawingRef.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  if (currentService?.id !== 'magic-erase') return null;

  return (
    <div
      ref={overlayRef}
      className="sam-selection-overlay magic-erase-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor: 'crosshair' }}
    >
      <canvas
        id="magic-erase-mask"
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.5, // See-through to the image
          pointerEvents: 'none'
        }}
      />

      {/* UI to clear mask */}
      <button
        onClick={(e) => { e.stopPropagation(); clearMask(); }}
        className="btn btn-secondary btn-tiny"
        style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            pointerEvents: 'auto'
        }}>
        Clear Mask
      </button>
    </div>
  );
};

export default MagicEraseOverlay;
