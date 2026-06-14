/*
 * Controller hook for Segment Anything, coordinating coordinates points and worker threads.
 */
import { useSegmentation, useWorkspace, useUI, useService } from '../store';
import { useProcessor } from './useProcessorContext';
import { APP_CONFIG } from '../config/app';

export const useSAM = () => {
  const samPoints = useSegmentation((state) => state.samPoints);
  const setSamPoints = useSegmentation((state) => state.setSamPoints);
  const editing = useSegmentation((state) => state.editing);
  const setSegmentationResult = useSegmentation((state) => state.setSegmentationResult);
  const { originalCanvas } = useWorkspace();
  const showToast = useUI((state) => state.showToast);
  const { serviceSettings } = useService();

  const { execute } = useProcessor();

  // Appends a mouse click coordinate point to the prompt list for positive (keep) or negative (remove) filters
  const addPoint = (x, y, forcedLabel = null) => {
    if (!originalCanvas) return;
    
    // Determine label: use forced label if provided, otherwise fallback to UI setting
    const uiLabel = serviceSettings['object-segmentation']?.pointLabel ?? 1;
    const label = forcedLabel !== null ? forcedLabel : uiLabel;
    
    const newPoints = [...samPoints, { x, y, label }];
    setSamPoints(newPoints);
  };

  // Clears all currently placed selection points from the workspace editor
  const clearPoints = () => {
    setSamPoints([]);
  };

  // Compiles points prompting arrays and executes the SAM AI segmentation worker task
  const executeSmartSelect = async () => {
    if (!originalCanvas || samPoints.length === 0) {
      showToast('Please select at least one point', 'info');
      return;
    }

    // Clear stale segmentation results before starting new inference
    setSegmentationResult(null);

    const options = {
      ...serviceSettings['object-segmentation'],
      points: samPoints.map(p => ({ x: p.x, y: p.y, label: p.label })),
      mode: editing.activeMode || 'extract',
      modelId: serviceSettings['object-segmentation']?.modelId || APP_CONFIG.samDefaultModel
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
  };

  return {
    samPoints,
    addPoint,
    clearPoints,
    executeSmartSelect,
    samPointLabel: serviceSettings['object-segmentation']?.pointLabel ?? 1
  };
};
