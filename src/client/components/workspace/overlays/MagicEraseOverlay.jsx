import { useRef, useEffect, useState } from "react";
import { useSegmentation, useService, useUI, useWorkspace } from "../../../store";
import { SEGMENTATION_MODELS } from "../../../config/models";
import { process as runSamSegmentation } from "../../../services/object-segmentation/processor";

// Magic Erase overlay component - handles brush and point selection for object removal
const MagicEraseOverlay = ({ srcRef }) => {
  // State and store hooks
  const { currentService, serviceSettings } = useService();
  const { originalCanvas } = useWorkspace();
  const setIsProcessing = useWorkspace((state) => state.setIsProcessing);
  const updateProgress = useUI((state) => state.updateProgress);
  const showToast = useUI((state) => state.showToast);
  const setMagicEraseMaskCanvas = useSegmentation((state) => state.setMagicEraseMaskCanvas);
  const isGeneratingMask = useSegmentation((state) => state.isGeneratingMask);
  const setIsGeneratingMask = useSegmentation((state) => state.setIsGeneratingMask);
  
  // Refs for canvas and interaction state
  const overlayRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const generationIdRef = useRef(0);
  const isGeneratingRef = useRef(false);
  const nextPointsRef = useRef(null);
  const samPointsRef = useRef([]);
  const [samPoints, setSamPoints] = useState([]);

  // Get magic erase settings (brush/point mode and brush size)
  const settings = serviceSettings["magic-erase"] || {};
  const selectionMode = settings.selectionMode || "brush";
  const brushRadius = settings.radius || 20;

  // Sync overlay position and size with source image canvas
  // Also handles canvas resize and initializes black background
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
  }, [srcRef, currentService?.id, originalCanvas]);

  // Register/unregister mask canvas when magic-erase service is active
  useEffect(() => {
    if (currentService?.id !== "magic-erase") {
      setMagicEraseMaskCanvas(null);
      samPointsRef.current = [];
      setSamPoints([]);
      return;
    }

    setMagicEraseMaskCanvas(canvasRef.current);
    return () => setMagicEraseMaskCanvas(null);
  }, [currentService, setMagicEraseMaskCanvas]);

  // Clear SAM points when selection mode changes or image changes
  useEffect(() => {
    samPointsRef.current = [];
    setSamPoints([]);
  }, [selectionMode, originalCanvas]);

  // Convert mouse/touch coordinates to canvas coordinates
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

  // Draw brush stroke on mask canvas (white = erase area)
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

  // Paint SAM-generated mask onto canvas (convert to white on black with 100% binary strength)
  const paintSamMask = (candidate) => {
    const canvas = canvasRef.current;
    if (!canvas || !candidate?.maskBitmap) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(candidate.maskBitmap, 0, 0, canvas.width, canvas.height);

    const tempData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = tempData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Threshold soft SAM edges to full binary (100% strength) black/white mask
      const maskValue = data[i + 3] > 127 ? 255 : 0;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = maskValue;
    }
    tempCtx.putImageData(tempData, 0, 0);

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  };

  // Clean up SAM result bitmaps to free memory
  const disposeSamResult = (result) => {
    if (!result?.options) return;
    result.options.forEach((candidate) => {
      if (candidate?.maskBitmap && typeof candidate.maskBitmap.close === "function") {
        try { candidate.maskBitmap.close(); } catch (_) {}
      }
    });
  };

  // Generate mask using SAM based on point selections (silent background execution)
  const generatePointMask = async (points) => {
    if (!originalCanvas || points.length === 0) return;

    if (isGeneratingRef.current) {
      nextPointsRef.current = points;
      return;
    }

    isGeneratingRef.current = true;
    setIsGeneratingMask(true);

    const runId = generationIdRef.current + 1;
    generationIdRef.current = runId;

    let result = null;
    try {
      result = await runSamSegmentation(
        originalCanvas,
        {
          tier: "free",
          mode: "mask",
          points,
          modelId: SEGMENTATION_MODELS.sam2_1_tiny.model_id,
        },
        () => {}, // Silent progress updates to prevent overriding the main loader state
      );

      if (generationIdRef.current !== runId) {
        disposeSamResult(result);
        return;
      }

      const candidate = result?.options?.[0];
      if (!candidate) {
        throw new Error("SAM did not return a mask.");
      }

      paintSamMask(candidate);
    } catch (err) {
      console.error("[Magic Erase] Point selection failed:", err);
      showToast(`Point selection failed: ${err.message}`, "error");
    } finally {
      disposeSamResult(result);
      if (generationIdRef.current === runId) {
        if (nextPointsRef.current) {
          const queuedPoints = nextPointsRef.current;
          nextPointsRef.current = null;
          isGeneratingRef.current = false;
          generatePointMask(queuedPoints);
        } else {
          isGeneratingRef.current = false;
          setIsGeneratingMask(false);
        }
      }
    }
  };

  // Handle mouse down - add point or start brush drawing
  const handleMouseDown = (e) => {
    if (currentService?.id !== "magic-erase") return;
    if (selectionMode === "point") {
      if (e.button === 2) e.preventDefault();

      const coords = getCanvasCoords(e);
      if (!coords || !canvasRef.current) return;

      const isNegative = e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;
      const nextPoints = [
        ...samPointsRef.current,
        {
          x: coords.x / canvasRef.current.width,
          y: coords.y / canvasRef.current.height,
          label: isNegative ? 0 : 1,
        },
      ];
      samPointsRef.current = nextPoints;
      setSamPoints(nextPoints);
      generatePointMask(nextPoints);
      return;
    }

    if (e.button === 0) {
      // Left-click
      isDrawingRef.current = true;
      const coords = getCanvasCoords(e);
      if (coords) drawBrush(coords.x, coords.y);
    }
  };

  // Handle mouse move - continue brush drawing
  const handleMouseMove = (e) => {
    if (selectionMode !== "brush") return;
    if (!isDrawingRef.current) return;
    const coords = getCanvasCoords(e);
    if (coords) drawBrush(coords.x, coords.y);
  };

  // Handle mouse up - stop brush drawing
  const handleMouseUp = () => {
    isDrawingRef.current = false;
  };

  // Touch equivalents - handle touch events for mobile support
  const handleTouchStart = (e) => {
    if (currentService?.id !== "magic-erase") return;
    if (e.touches.length === 0) return;
    e.preventDefault();
    if (selectionMode === "point") {
      const coords = getCanvasCoords(e.touches[0]);
      if (!coords || !canvasRef.current) return;
      const nextPoints = [
        ...samPointsRef.current,
        {
          x: coords.x / canvasRef.current.width,
          y: coords.y / canvasRef.current.height,
          label: 1,
        },
      ];
      samPointsRef.current = nextPoints;
      setSamPoints(nextPoints);
      generatePointMask(nextPoints);
      return;
    }


    isDrawingRef.current = true;
    const coords = getCanvasCoords(e.touches[0]);
    if (coords) drawBrush(coords.x, coords.y);
  };

  // Handle touch move - continue brush drawing on mobile
  const handleTouchMove = (e) => {
    if (selectionMode !== "brush") return;
    if (!isDrawingRef.current) return;
    if (e.touches.length === 0) return;
    e.preventDefault();
    const coords = getCanvasCoords(e.touches[0]);
    if (coords) drawBrush(coords.x, coords.y);
  };

  // Handle touch end - stop brush drawing on mobile
  const handleTouchEnd = () => {
    isDrawingRef.current = false;
  };

  // Clear the mask canvas and reset SAM points
  const clearMask = () => {
    generationIdRef.current += 1;
    samPointsRef.current = [];
    setSamPoints([]);
    nextPointsRef.current = null;
    isGeneratingRef.current = false;
    setIsGeneratingMask(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // Global mouseup handler to stop drawing even if mouse leaves canvas
  useEffect(() => {
    const up = () => {
      isDrawingRef.current = false;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // Don't render overlay if magic-erase service is not active
  if (currentService?.id !== "magic-erase") return null;

  return (
    <div
      ref={overlayRef}
      className="sam-selection-overlay magic-erase-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor: "crosshair" }}
    >
      {/* Canvas for displaying the erase mask (white = erase, black = keep) */}
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

      {/* Render point markers in point selection mode */}
      {selectionMode === "point" && samPoints.map((point, idx) => (
        <div
          key={`${point.x}-${point.y}-${idx}`}
          className={`magic-erase-point ${point.label === 1 ? "positive" : "negative"}`}
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
          }}
        />
      ))}

      {/* Show loading status while generating mask */}
      {selectionMode === "point" && isGeneratingMask && (
        <div className="magic-erase-mask-status">Selecting...</div>
      )}

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
