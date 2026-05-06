import React, { useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useSAM } from '../../../hooks/useSAM';

const SAMOverlay = ({ srcRef }) => {
  const { currentService, editing } = useApp();
  const { samPoints, addPoint, brushCanvasRef, onBrushComplete } = useSAM();
  const overlayRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const brushSize = editing.brushSize || 20;

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

      // Sync brush canvas dimensions to match source image (for accurate pixel coords)
      if (canvasRef.current) {
        canvasRef.current.width = canvas.width || canvas.offsetWidth;
        canvasRef.current.height = canvas.height || canvas.offsetHeight;
        // Link to useSAM's ref
        brushCanvasRef.current = canvasRef.current;
      }
    };

    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [srcRef, samPoints, brushCanvasRef]);

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

  const handleMouseDown = useCallback((e) => {
    if (currentService?.id !== 'object-segmentation') return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (e.button === 2) {
      e.preventDefault();
    }

    // Right-click or holding modified keys makes it a negative point (label: 0)
    const isNegative = e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;
    
    addPoint(x, y, isNegative);
  }, [currentService, addPoint]);

  if (currentService?.id !== 'object-segmentation') return null;

  return (
    <div
      ref={overlayRef}
      className="sam-selection-overlay"
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor: 'crosshair' }}
    >
      {/* Brush painting canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
      {/* Legacy: point indicators for right-click refinement */}
      {samPoints.map((point, idx) => (
        <div
          key={idx}
          className={`sam-point ${point.label === 1 ? 'positive' : 'negative'}`}
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`
          }}
        />
      ))}
    </div>
  );
};

export default SAMOverlay;
