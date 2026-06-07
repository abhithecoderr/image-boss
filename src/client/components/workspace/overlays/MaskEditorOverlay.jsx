import React, { useRef } from "react";
import { useWorkspace, useSegmentation } from "../../../store";
import { useMaskEditor } from "../../../hooks/useMaskEditor";

const MaskEditorOverlay = ({ resRef }) => {
  const { resultCanvas } = useWorkspace();
  const editing = useSegmentation((state) => state.editing);
  const { startDrawing, moveDrawing, endDrawing } = useMaskEditor(resRef);
  const brushPreviewRef = useRef(null);

  const handleMouseMove = (e) => {
    // Call the mask editor's drawing handler
    moveDrawing(e);

    // Update brush preview position and size (centered on cursor, relative to container)
    if (brushPreviewRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = editing.brushSize;

      brushPreviewRef.current.style.display = "block";
      brushPreviewRef.current.style.left = `${x - size / 2}px`;
      brushPreviewRef.current.style.top = `${y - size / 2}px`;
      brushPreviewRef.current.style.width = `${size}px`;
      brushPreviewRef.current.style.height = `${size}px`;
    }
  };

  const handleMouseLeave = (e) => {
    // End drawing
    endDrawing(e);

    // Hide brush preview
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
      />
      <div ref={brushPreviewRef} className="brush-preview" />
    </>
  );
};

export default MaskEditorOverlay;
