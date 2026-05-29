import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspace, useService } from "../../context/AppContext";

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

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setPosition((x / rect.width) * 100);
  }, []);

  const onMouseDown = (e) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      handleMove(e.clientX);
    };

    const onMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    } else {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, handleMove]);

  if (currentService.id !== "upscaling" || !resultCanvas) return null;

  const aspectRatio = resultCanvas.width / resultCanvas.height;

  return (
    <div
      ref={containerRef}
      className="comparison-slider-container"
      onMouseDown={onMouseDown}
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
