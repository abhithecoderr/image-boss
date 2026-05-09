import { useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAppEngine } from './useAppEngine';

/**
 * Derive a bounding box [x1, y1, x2, y2] and sampled positive points
 * from a brush-painted canvas. All values are normalized to [0, 1].
 */
function deriveBBoxAndPoints(brushCanvas) {
  const ctx = brushCanvas.getContext('2d');
  const { width, height } = brushCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  const paintedPixels = [];

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

  const padX = width * 0.02;
  const padY = height * 0.02;
  const box = [
    Math.max(0, minX - padX) / width,
    Math.max(0, minY - padY) / height,
    Math.min(width, maxX + padX) / width,
    Math.min(height, maxY + padY) / height
  ];

  const numPoints = Math.min(8, paintedPixels.length);
  const step = Math.floor(paintedPixels.length / numPoints);
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const px = paintedPixels[i * step];
    points.push({ x: px.x / width, y: px.y / height, label: 1 });
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
    setSegmentationResult
  } = useApp();

  const { execute } = useAppEngine();

  const brushCanvasRef = useRef(null);
  const brushBoxRef = useRef(null);

  const addPoint = useCallback((x, y, isNegative) => {
    if (!originalCanvas) return;
    const label = isNegative ? 0 : 1;
    const newPoints = [...samPoints, { x, y, label }];
    setSamPoints(newPoints);
    brushBoxRef.current = null;
  }, [samPoints, setSamPoints, originalCanvas]);

  const clearPoints = useCallback(() => {
    setSamPoints([]);
    if (brushCanvasRef.current) {
      const ctx = brushCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, brushCanvasRef.current.width, brushCanvasRef.current.height);
    }
    brushBoxRef.current = null;
  }, [setSamPoints]);

  const onBrushComplete = useCallback(async (brushCanvas) => {
    if (!originalCanvas || !brushCanvas) return;

    const derived = deriveBBoxAndPoints(brushCanvas);
    if (!derived) {
      showToast('Paint over the object to select it', 'info');
      return;
    }

    brushBoxRef.current = derived.box;
    setSamPoints(derived.points);

    const options = {
      points: derived.points,
      box: derived.box,
      mode: editing.activeMode || 'extract',
      modelId: 'Xenova/slimsam-77-uniform'
    };

    try {
      const result = await execute(options);
      if (result) {
        setSegmentationResult(result);
      }
      return result;
    } catch (err) {
      console.error('[SAM] Brush select failed:', err);
    }
  }, [originalCanvas, editing.activeMode, execute, showToast, setSamPoints, setSegmentationResult]);

  const executeSmartSelect = useCallback(async () => {
    if (!originalCanvas || samPoints.length === 0) {
      showToast('Please select at least one point', 'info');
      return;
    }

    const options = {
      points: samPoints.map(p => ({ x: p.x, y: p.y, label: p.label })),
      box: brushBoxRef.current,
      mode: editing.activeMode || 'extract',
      modelId: 'Xenova/slimsam-77-uniform'
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
  }, [originalCanvas, samPoints, editing.activeMode, execute, showToast, setSegmentationResult]);

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

