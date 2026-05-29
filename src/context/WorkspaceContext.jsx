import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { disposeBatchItem } from "../core/BatchItem";

// Create context for storing globally shared workspaces and image queues
const WorkspaceContext = createContext();

/* 
 WorkspaceProvider:
 Manages the active workspace state including the loaded files list,
 select checkboxes, processing steps, active selections, and core viewport assets.
*/
export const WorkspaceProvider = ({ children }) => {
  // --- Unified Queue & Pipeline State ---
  const [items, setItems] = useState([]); // Array of plain BatchItem objects representing uploaded images
  const [activeItemId, setActiveItemId] = useState(null); // Unique ID representing the currently focused viewport item
  const [workflowSteps, setWorkflowSteps] = useState([]); // Array of active workflow step options: {id, serviceId, options}
  const [selectedIds, setSelectedIds] = useState(new Set()); // A Set of currently checked item IDs (for batch actions)
  const [batchMode, setBatchMode] = useState("single"); // UI mode toggle: 'single' (focused editing) or 'batch' (bulk actions)
  const [isProcessing, setIsProcessing] = useState(false); // Global flag locking UI panels during background AI tasks

  // --- Derive Active Item & Properties (Viewport syncing) ---
  const activeItem = useMemo(() => {
    return items.find((i) => i.id === activeItemId) || null;
  }, [items, activeItemId]);

  // Viewport helper properties extracted dynamically from the focused BatchItem
  const originalCanvas = activeItem?.sourceCanvas || null;
  const originalFile = activeItem?.file || null;
  const resultCanvas = activeItem?.resultCanvas || null;

  // --- State Mutators linked to Active Queue Item ---

  // Replaces the original canvas data of the active viewport item
  const setOriginalCanvas = useCallback(
    (canvas) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === activeItemId ? { ...item, sourceCanvas: canvas } : item,
        ),
      );
    },
    [activeItemId],
  );

  // Replaces the original raw File reference of the active viewport item
  const setOriginalFile = useCallback(
    (file) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === activeItemId ? { ...item, file } : item,
        ),
      );
    },
    [activeItemId],
  );

  // Syncs final AI canvas results to the active viewport item
  const setResultCanvas = useCallback(
    (canvas) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === activeItemId ? { ...item, resultCanvas: canvas } : item,
        ),
      );
    },
    [activeItemId],
  );

  // Completely clears the workspace environment, disposing of GPU/RAM canvas objects to prevent memory leaks
  const resetImages = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => disposeBatchItem(item)); // Close cached bitmaps and canvases
      return [];
    });
    setActiveItemId(null);
    setWorkflowSteps([]);
    setSelectedIds(new Set());
    setBatchMode("single");
    setIsProcessing(false);
  }, []);

  // Packaged context state
  const value = useMemo(
    () => ({
      originalCanvas,
      setOriginalCanvas,
      originalFile,
      setOriginalFile,
      resultCanvas,
      setResultCanvas,
      isProcessing,
      setIsProcessing,

      items,
      setItems,
      activeItemId,
      setActiveItemId,
      workflowSteps,
      setWorkflowSteps,
      selectedIds,
      setSelectedIds,
      batchMode,
      setBatchMode,

      resetImages,
    }),
    [
      originalCanvas,
      originalFile,
      resultCanvas,
      isProcessing,
      items,
      activeItemId,
      workflowSteps,
      selectedIds,
      batchMode,
      setOriginalCanvas,
      setOriginalFile,
      setResultCanvas,
      resetImages,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

// Safe hook wrapper to verify context presence
export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return context;
};
