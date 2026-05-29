import React, { createContext, useContext, useState, useCallback } from "react";

// Context storing reactive states for interactive SAM (Segment Anything Model) point grids and manual mask editing brushes
const SegmentationContext = createContext();

/* 
 SegmentationProvider:
 Handles coordinates, click labels (keep or remove), brush sizes, active tools,
 and current drawing states for object segmentation overlays and manual touchups.
*/
export const SegmentationProvider = ({ children }) => {
  const [samPoints, setSamPoints] = useState([]); // Array of positive/negative coordinate clicks: {x, y, label}
  const [samPointLabel, setSamPointLabel] = useState(1); // Click modifier: 1 (positive click/keep) or 0 (negative click/remove)
  const [segmentationResult, setSegmentationResult] = useState(null); // Generated mask boundary canvas or polygon path data

  // Brush configs for direct canvas editing
  const [editing, setEditing] = useState({
    activeTool: "none", // Active gesture: 'none' (move), 'erase' (transparent mask), or 'restore' (draw back)
    activeMode: "extract", // Mode logic: 'extract' (cut out object) or 'overlay'
    brushSize: 30, // Active touch radius in pixels
    isDrawing: false, // Mouse/touch dragging click lock
  });

  const [activeEditorTab, setActiveEditorTab] = useState("composition"); // Tab router for segmentation controls

  // Restores all interactive clicks and manual modifications to base clean state
  const resetSegmentationState = useCallback(() => {
    setSamPoints([]);
    setSamPointLabel(1);
    setSegmentationResult(null);
    setEditing({
      activeTool: "none",
      activeMode: "extract",
      brushSize: 30,
      isDrawing: false,
    });
    setActiveEditorTab("composition");
  }, []);

  const value = {
    samPoints,
    setSamPoints,
    samPointLabel,
    setSamPointLabel,
    segmentationResult,
    setSegmentationResult,
    editing,
    setEditing,
    activeEditorTab,
    setActiveEditorTab,
    resetSegmentationState,
  };

  return (
    <SegmentationContext.Provider value={value}>
      {children}
    </SegmentationContext.Provider>
  );
};

export const useSegmentation = () => {
  const context = useContext(SegmentationContext);
  if (!context)
    throw new Error(
      "useSegmentation must be used within a SegmentationProvider",
    );
  return context;
};
