import React, { createContext, useContext, useState, useCallback } from 'react';

const WorkspaceContext = createContext();

export const WorkspaceProvider = ({ children }) => {
  // --- Core Image State ---
  const [originalCanvas, setOriginalCanvas] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [resultCanvas, setResultCanvas] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Unified Queue & Pipeline State ---
  const [items, setItems] = useState([]); // Array of ProcessingItem
  const [activeItemId, setActiveItemId] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]); // Array of {id, serviceId, options}
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchMode, setBatchMode] = useState('single');

  const resetImages = useCallback(() => {
    if (originalCanvas?.close) originalCanvas.close();
    if (resultCanvas?.close) resultCanvas.close();
    
    setOriginalCanvas(null);
    setOriginalFile(null);
    setResultCanvas(null);
    setIsProcessing(false);
    
    setItems(prev => {
      prev.forEach(item => item.dispose());
      return [];
    });
    setActiveItemId(null);
    setWorkflowSteps([]);
    setSelectedIds(new Set());
    setBatchMode('single');
  }, []);

  const value = React.useMemo(() => ({
    originalCanvas, setOriginalCanvas,
    originalFile, setOriginalFile,
    resultCanvas, setResultCanvas,
    isProcessing, setIsProcessing,
    
    // New Unified State
    items, setItems,
    activeItemId, setActiveItemId,
    workflowSteps, setWorkflowSteps,
    selectedIds, setSelectedIds,
    batchMode, setBatchMode,
    
    resetImages
  }), [
    originalCanvas, originalFile, resultCanvas, isProcessing,
    items, activeItemId, workflowSteps, selectedIds, batchMode,
    resetImages
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return context;
};
