/*
 * Split-screen visual overlay allowing users to slide and compare the original image side-by-side with processed output.
 */
import React, { useState, useRef, useEffect } from "react";
import { useWorkspace, useService } from "../../store";

const ComparisonSlider = () => {
  const { originalCanvas, resultCanvas } = useWorkspace();
  const { currentService } = useService();
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const upRef = useRef(null);
  const origRef = useRef(null);

  useEffect(() => {
    if (originalCanvas && resultCanvas && upRef.current && origRef.current) {
      const upCtx = upRef.current.getContext("2d");
      const origCtx = origRef.current.getContext("2d");

      upRef.current.width = resultCanvas.width;
      upRef.current.height = resultCanvas.height;
      upCtx.drawImage(resultCanvas, 0, 0);

      origRef.current.width = resultCanvas.width;
      origRef.current.height = resultCanvas.height;
      origCtx.drawImage(
        originalCanvas,
        0,
        0,
        originalCanvas.width,
        originalCanvas.height,
        0,
        0,
        resultCanvas.width,
        resultCanvas.height,
      );
    }
  }, [originalCanvas, resultCanvas]);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setPosition((x / rect.width) * 100);
  };

  const onMouseDown = (e) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const onTouchStart = (e) => {
    if (e.touches.length === 0) return;
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      handleMove(e.clientX);
    };

    const onMouseUp = () => setIsDragging(false);

    // Touch equivalents: read the first touch's clientX. preventDefault on move
    // so the page doesn't scroll while dragging the comparison handle.
    const onTouchMove = (e) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };

    const onTouchEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
    } else {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging, handleMove]);

  if (currentService.id !== "upscaling" || !resultCanvas) return null;

  const aspectRatio = resultCanvas.width / resultCanvas.height;

  return (
    <div
      ref={containerRef}
      className="comparison-slider-container"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{
        aspectRatio: `${aspectRatio}`,
      }}
    >
      {/* Upscaled Layer (Bottom) */}
      <div className="comparison-layer">
        <canvas ref={upRef} />
      </div>

      {/* Original Layer (Top with clip-path) */}
      <div
        className="comparison-layer"
        style={{
          clipPath: `inset(0 0 0 ${position}%)`,
          zIndex: 2,
        }}
      >
        <canvas ref={origRef} />
      </div>

      {/* Handle */}
      <div
        className="slider-handle"
        style={{
          left: `${position}%`,
        }}
      >
        <div className="slider-handle-circle">⬌</div>
      </div>

      {/* Labels */}
      <div className="slider-badge slider-badge-left">UPSCALED</div>
      <div className="slider-badge slider-badge-right">ORIGINAL</div>
    </div>
  );
};

export default ComparisonSlider;
