/*
 * Split-screen visual overlay allowing users to slide and compare the original image side-by-side with processed output.
 * Uses GPU-accelerated CSS clip-path layering to achieve butter-smooth rendering even for massive high-res images.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspace, useService } from "../../store";

const ComparisonSlider = () => {
  const { originalCanvas, resultCanvas } = useWorkspace();
  const { currentService } = useService();
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  
  const originalCanvasRef = useRef(null);
  const resultCanvasRef = useRef(null);

  // Sync drawing buffer dimensions and draw original canvas once
  useEffect(() => {
    if (originalCanvas && originalCanvasRef.current) {
      const canvas = originalCanvasRef.current;
      const ctx = canvas.getContext("2d");
      
      const W = originalCanvas.width;
      const H = originalCanvas.height;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(originalCanvas, 0, 0);
    }
  }, [originalCanvas]);

  // Sync drawing buffer dimensions and draw result canvas once
  useEffect(() => {
    if (resultCanvas && resultCanvasRef.current) {
      const canvas = resultCanvasRef.current;
      const ctx = canvas.getContext("2d");
      
      const W = resultCanvas.width;
      const H = resultCanvas.height;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(resultCanvas, 0, 0);
    }
  }, [resultCanvas]);

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

  const sliderServices = ["background-removal", "upscaling", "blur", "line-art"];
  if (!sliderServices.includes(currentService.id) || !resultCanvas) return null;

  const getLeftLabel = () => {
    switch (currentService.id) {
      case "upscaling":
        return "UPSCALED";
      case "background-removal":
        return "REMOVED BG";
      case "blur":
        return "BLURRED";
      case "line-art":
        return "LINE ART";
      default:
        return "RESULT";
    }
  };

  const aspectRatio = resultCanvas.width / resultCanvas.height;

  return (
    <div
      ref={containerRef}
      className="comparison-slider-container"
      style={{
        aspectRatio: `${aspectRatio}`,
        width: aspectRatio > 1 ? "100%" : "auto",
        height: aspectRatio > 1 ? "auto" : "100%",
        position: "relative",
        userSelect: "none"
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* Background layer: Original Image (clipped using CSS clip-path to show only on the right side of the slider) */}
      <canvas 
        ref={originalCanvasRef} 
        className="comparison-canvas-main"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          clipPath: `polygon(${position}% 0, 100% 0, 100% 100%, ${position}% 100%)`
        }}
      />

      {/* Foreground layer: Result Image (clipped using CSS clip-path to show only on the left side) */}
      <canvas 
        ref={resultCanvasRef} 
        className="comparison-canvas-main"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          clipPath: `polygon(0 0, ${position}% 0, ${position}% 100%, 0 100%)`
        }}
      />

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
      <div className="slider-badge slider-badge-left">{getLeftLabel()}</div>
      <div className="slider-badge slider-badge-right">ORIGINAL</div>
    </div>
  );
};

export default ComparisonSlider;
