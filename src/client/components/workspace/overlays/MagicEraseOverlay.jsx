import { useRef, useEffect } from "react";
import { useSegmentation, useService, useWorkspace } from "../../../store";

const MagicEraseOverlay = ({ srcRef }) => {
  const { currentService, serviceSettings } = useService();
  const { originalCanvas } = useWorkspace();
  const setMagicEraseMaskCanvas = useSegmentation((state) => state.setMagicEraseMaskCanvas);
  const overlayRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Get settings
  const settings = serviceSettings["magic-erase"] || {};
  const brushRadius = settings.radius || 20;

  // Sync overlay position/size with source image canvas
  useEffect(() => {
    if (currentService?.id !== "magic-erase") return;

    const sync = () => {
      if (!overlayRef.current || !srcRef.current) return;
      const canvas = srcRef.current;
      const overlay = overlayRef.current;

      overlay.style.width = `${canvas.offsetWidth}px`;
      overlay.style.height = `${canvas.offsetHeight}px`;
      overlay.style.left = `${canvas.offsetLeft}px`;
      overlay.style.top = `${canvas.offsetTop}px`;

      if (canvasRef.current) {
        const wasNew =
          canvasRef.current.width !== (canvas.width || canvas.offsetWidth) ||
          canvasRef.current.height !== (canvas.height || canvas.offsetHeight);
        canvasRef.current.width = canvas.width || canvas.offsetWidth;
        canvasRef.current.height = canvas.height || canvas.offsetHeight;

        if (wasNew) {
          const ctx = canvasRef.current.getContext("2d");
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    };

    sync();

    const ro = new ResizeObserver(sync);
    if (srcRef.current) ro.observe(srcRef.current);
    window.addEventListener("resize", sync);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [srcRef, currentService, originalCanvas]);

  useEffect(() => {
    if (currentService?.id !== "magic-erase") {
      setMagicEraseMaskCanvas(null);
      return;
    }

    setMagicEraseMaskCanvas(canvasRef.current);
    return () => setMagicEraseMaskCanvas(null);
  }, [currentService, setMagicEraseMaskCanvas]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawBrush = (x, y) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      // Convert brush size back relative to actual canvas resolution vs screen size
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      const scaledBrush = brushRadius * scale;

      ctx.globalCompositeOperation = "source-over";
      // Draw white for the mask (255 = erase)
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(x, y, scaledBrush / 2, 0, Math.PI * 2);
      ctx.fill();
    };

  const handleMouseDown = (e) => {
    if (currentService?.id !== "magic-erase") return;

    if (e.button === 0) {
      // Left-click
      isDrawingRef.current = true;
      const coords = getCanvasCoords(e);
      if (coords) drawBrush(coords.x, coords.y);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawingRef.current) return;
    const coords = getCanvasCoords(e);
    if (coords) drawBrush(coords.x, coords.y);
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
  };

  // Touch equivalents — feed the first touch's coords into the same draw path.
  const handleTouchStart = (e) => {
    if (currentService?.id !== "magic-erase") return;
    if (e.touches.length === 0) return;
    e.preventDefault();
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e.touches[0]);
    if (coords) drawBrush(coords.x, coords.y);
  };

  const handleTouchMove = (e) => {
    if (!isDrawingRef.current) return;
    if (e.touches.length === 0) return;
    e.preventDefault();
    const coords = getCanvasCoords(e.touches[0]);
    if (coords) drawBrush(coords.x, coords.y);
  };

  const handleTouchEnd = () => {
    isDrawingRef.current = false;
  };

  const clearMask = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // Cleanup: listen for mouseup on window
  useEffect(() => {
    const up = () => {
      isDrawingRef.current = false;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  if (currentService?.id !== "magic-erase") return null;

  return (
    <div
      ref={overlayRef}
      className="sam-selection-overlay magic-erase-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor: "crosshair" }}
    >
      <canvas
        id="magic-erase-mask"
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 0.5, // See-through to the image
          pointerEvents: "none",
        }}
      />

      {/* UI to clear mask */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          clearMask();
        }}
        className="btn btn-secondary btn-tiny"
        style={{
          position: "absolute",
          bottom: "10px",
          right: "10px",
          pointerEvents: "auto",
        }}
      >
        Clear Mask
      </button>
    </div>
  );
};

export default MagicEraseOverlay;
