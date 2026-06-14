import React, { useRef } from "react";
import { useWorkspace, useSegmentation } from "../../../store";
import { useMaskEditor } from "../../../hooks/useMaskEditor";

const MaskEditorOverlay = ({ resRef }) => {
  const { resultCanvas } = useWorkspace();
  const editing = useSegmentation((state) => state.editing);
  const { startDrawing, moveDrawing, endDrawing } = useMaskEditor(resRef);
  const brushPreviewRef = useRef(null);

  // Move the brush-preview circle to the pointer. Works for mouse and touch;
  // `target` is the overlay div, and `point` is either the MouseEvent or a
  // Touch from e.touches[0].
  const updatePreview = (target, clientX, clientY) => {
    if (!brushPreviewRef.current) return;
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const size = editing.brushSize;

    brushPreviewRef.current.style.display = "block";
    brushPreviewRef.current.style.left = `${x - size / 2}px`;
    brushPreviewRef.current.style.top = `${y - size / 2}px`;
    brushPreviewRef.current.style.width = `${size}px`;
    brushPreviewRef.current.style.height = `${size}px`;
  };

  const handleMouseMove = (e) => {
    // Call the mask editor's drawing handler
    moveDrawing(e);
    updatePreview(e.currentTarget, e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
    // End drawing
    endDrawing();
    // Hide brush preview
    if (brushPreviewRef.current) {
      brushPreviewRef.current.style.display = "none";
    }
  };

  // Touch: feed the first touch into the same draw path. preventDefault stops
  // the page from scrolling while the user paints with their finger.
  const handleTouchStart = (e) => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    startDrawing(e);
    updatePreview(e.currentTarget, e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 0) return;
    e.preventDefault();
    moveDrawing(e);
    updatePreview(e.currentTarget, e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    endDrawing();
    if (brushPreviewRef.current) {
      brushPreviewRef.current.style.display = "none";
    }
  };

  if (editing.activeTool === "none" || !resultCanvas) return null;

  return (
    <>
      <div
        className="mask-draw-overlay"
        onMouseDown={startDrawing}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrawing}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <div ref={brushPreviewRef} className="brush-preview" />
    </>
  );
};

export default MaskEditorOverlay;
