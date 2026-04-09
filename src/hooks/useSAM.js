import { useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useProcessor } from './useProcessor';

/**
 * Derive a bounding box [x1, y1, x2, y2] and sampled positive points
 * from a brush-painted canvas. All values are normalized to [0, 1].
 * @param {HTMLCanvasElement} brushCanvas - Canvas with painted white pixels on transparent bg
 * @returns {{ box: number[], points: {x: number, y: number, label: number}[] } | null}
 */
function deriveBBoxAndPoints(brushCanvas) {
  const ctx = brushCanvas.getContext('2d');
  const { width, height } = brushCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  const paintedPixels = [];

  // Scan for painted pixels (alpha > 128)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        paintedPixels.push({ x, y });
      }
    }
  }

  if (paintedPixels.length === 0) return null;

  // Pad the bounding box slightly (2% of image dimension)
  const padX = width * 0.02;
  const padY = height * 0.02;
  const box = [
    Math.max(0, minX - padX) / width,
    Math.max(0, minY - padY) / height,
    Math.min(width, maxX + padX) / width,
    Math.min(height, maxY + padY) / height
  ];

  // Sample ~8 evenly distributed points from painted region
  const numPoints = Math.min(8, paintedPixels.length);
  const step = Math.floor(paintedPixels.length / numPoints);
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const px = paintedPixels[i * step];
    points.push({
      x: px.x / width,
      y: px.y / height,
      label: 1 // All positive
    });
  }

  return { box, points };
}

export const useSAM = () => {
  const {
    samPoints,
    setSamPoints,
    samPointLabel,
    editing,
    originalCanvas,
    showToast,
    updateProgress,
    setSegmentationResult
  } = useApp();

  const { process } = useProcessor();

  // Ref to the brush overlay canvas (set by SAMOverlay)
  const brushCanvasRef = useRef(null);
  // Ref to track current bounding box from brush
  const brushBoxRef = useRef(null);

  const addPoint = useCallback((x, y, isNegative) => {
    if (!originalCanvas) return;
    const label = isNegative ? 0 : 1;
    const newPoints = [...samPoints, { x, y, label }];
    
    setSamPoints(newPoints);
    brushBoxRef.current = null; // Using points now, clear box
  }, [samPoints, setSamPoints, originalCanvas]);

  const clearPoints = useCallback(() => {
    setSamPoints([]);
    // Clear brush canvas if it exists
    if (brushCanvasRef.current) {
      const ctx = brushCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, brushCanvasRef.current.width, brushCanvasRef.current.height);
    }
    brushBoxRef.current = null;
  }, [setSamPoints]);

  /**
   * Called by SAMOverlay when user finishes a brush stroke.
   * Derives box + points from the painted canvas and triggers inference.
   */
  const onBrushComplete = useCallback(async (brushCanvas) => {
    if (!originalCanvas || !brushCanvas) return;

    const derived = deriveBBoxAndPoints(brushCanvas);
    if (!derived) {
      showToast('Paint over the object to select it', 'info');
      return;
    }

    brushBoxRef.current = derived.box;

    // Set the sampled points into state (for logging/debug)
    setSamPoints(derived.points);

    const options = {
      points: derived.points,
      box: derived.box,
      mode: editing.activeMode || 'extract',
      modelId: 'Xenova/slimsam-77-uniform'
    };

    try {
      const result = await process(options);
      if (result) {
        setSegmentationResult(result);
      }
      return result;
    } catch (err) {
      console.error('[SAM] Brush select failed:', err);
    }
  }, [originalCanvas, editing.activeMode, process, showToast, setSamPoints, setSegmentationResult]);

  const executeSmartSelect = useCallback(async () => {
    if (!originalCanvas || samPoints.length === 0) {
      showToast('Please select at least one point', 'info');
      return;
    }

    const options = {
      points: samPoints.map(p => ({ x: p.x, y: p.y, label: p.label })),
      box: brushBoxRef.current, // Include box if derived from brush
      mode: editing.activeMode || 'extract',
      modelId: 'Xenova/slimsam-77-uniform'
    };

    try {
      const result = await process(options);
      if (result) {
        setSegmentationResult(result);
      }
      return result;
    } catch (err) {
      console.error('[SAM] Smart select failed:', err);
    }
  }, [originalCanvas, samPoints, editing.activeMode, process, showToast]);

  return {
    samPoints,
    addPoint,
    clearPoints,
    executeSmartSelect,
    samPointLabel,
    brushCanvasRef,
    onBrushComplete
  };
};
