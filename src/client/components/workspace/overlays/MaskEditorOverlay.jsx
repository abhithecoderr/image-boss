import React, { useRef, useEffect } from "react";
import { useWorkspace, useSegmentation } from "../../../store";
import { useMaskEditor } from "../../../hooks/useMaskEditor";

const MaskEditorOverlay = ({ resRef }) => {
  const { resultCanvas } = useWorkspace();
  const editing = useSegmentation((state) => state.editing);
  const { startDrawing, moveDrawing, endDrawing } = useMaskEditor(resRef);
  const brushPreviewRef = useRef(null);

  // Sync brush preview with mouse
  useEffect(() => {
    const onMove = (e) => {
      if (!brushPreviewRef.current || !resRef.current) return;

      const x = e.clientX;
      const y = e.clientY;
      const size = editing.brushSize;

      brushPreviewRef.current.style.display = "block";
      brushPreviewRef.current.style.left = `${x}px`;
      brushPreviewRef.current.style.top = `${y}px`;
      brushPreviewRef.current.style.width = `${size}px`;
      brushPreviewRef.current.style.height = `${size}px`;
    };

    const onLeave = () => {
      if (brushPreviewRef.current)
        brushPreviewRef.current.style.display = "none";
    };

    if (editing.activeTool !== "none" && resRef.current) {
      resRef.current.addEventListener("mousemove", onMove);
      resRef.current.addEventListener("mouseleave", onLeave);
    }

    return () => {
      if (resRef.current) {
        resRef.current.removeEventListener("mousemove", onMove);
        resRef.current.removeEventListener("mouseleave", onLeave);
      }
    };
  }, [editing.activeTool, editing.brushSize, resRef]);

  if (editing.activeTool === "none" || !resultCanvas) return null;

  return (
    <>
      <div
        className="mask-draw-overlay"
        onMouseDown={startDrawing}
        onMouseMove={moveDrawing}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
      />
      <div ref={brushPreviewRef} className="brush-preview" />
    </>
  );
};

export default MaskEditorOverlay;
