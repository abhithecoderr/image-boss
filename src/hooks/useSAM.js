import { useCallback } from 'react';
import { useSegmentation, useWorkspace, useUI, useService } from '../context/AppContext';
import { useUnifiedProcessor } from './useUnifiedProcessor';

/* 
 useSAM:
 Bridge hook linking interactive viewport clicks to Segment Anything Model capabilities.
 Manages points selection coords, clear routines, and compiles prompt arrays to send to the AI worker.
*/
export const useSAM = () => {
  const {
    samPoints,
    setSamPoints,
    editing,
    setSegmentationResult
  } = useSegmentation();
  const { originalCanvas } = useWorkspace();
  const { showToast } = useUI();
  const { serviceSettings } = useService();

  const { execute } = useUnifiedProcessor();

  // Appends a mouse click coordinate point to the prompt list for positive (keep) or negative (remove) filters
  const addPoint = useCallback((x, y, forcedLabel = null) => {
    if (!originalCanvas) return;
    
    // Determine label: use forced label if provided, otherwise fallback to UI setting
    const uiLabel = serviceSettings['object-segmentation']?.pointLabel ?? 1;
    const label = forcedLabel !== null ? forcedLabel : uiLabel;
    
    const newPoints = [...samPoints, { x, y, label }];
    setSamPoints(newPoints);
  }, [samPoints, setSamPoints, originalCanvas, serviceSettings]);

  // Clears all currently placed selection points from the workspace editor
  const clearPoints = useCallback(() => {
    setSamPoints([]);
  }, [setSamPoints]);

  // Compiles points prompting arrays and executes the SAM AI segmentation worker task
  const executeSmartSelect = useCallback(async () => {
    if (!originalCanvas || samPoints.length === 0) {
      showToast('Please select at least one point', 'info');
      return;
    }

    const options = {
      points: samPoints.map(p => ({ x: p.x, y: p.y, label: p.label })),
      mode: editing.activeMode || 'extract',
      modelId: serviceSettings['object-segmentation']?.modelId || 'Xenova/slimsam-77-uniform'
    };

    try {
      const result = await execute(options);
      if (result) {
        setSegmentationResult(result);
      }
      return result;
    } catch (err) {
      console.error('[SAM] Smart select failed:', err);
    }
  }, [originalCanvas, samPoints, editing.activeMode, execute, showToast, setSegmentationResult, serviceSettings]);

  return {
    samPoints,
    addPoint,
    clearPoints,
    executeSmartSelect,
    samPointLabel: serviceSettings['object-segmentation']?.pointLabel ?? 1
  };
};
