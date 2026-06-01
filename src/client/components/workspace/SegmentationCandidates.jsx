import React, { useState, useEffect, useRef } from "react";
import { useWorkspace, useSegmentation, useUI } from "../../store";

const CandidateCard = React.memo(({ candidate, idx, isSelected, onSelect }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current && candidate.maskBitmap) {
      const canvas = canvasRef.current;
      canvas.width = 120;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 120, 120);
      ctx.drawImage(candidate.maskBitmap, 0, 0, 120, 120);
    }
  }, [candidate]);

  return (
    <div
      className={`candidate-card ${isSelected ? "is-selected" : ""}`}
      onClick={() => onSelect(idx)}
    >
      <div className="layer-thumb-canvas">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>
      <div className="candidate-label">Option {idx + 1}</div>
    </div>
  );
});

const SegmentationCandidates = () => {
  const { segmentationResult } = useSegmentation();
  const originalCanvas = useWorkspace((state) => {
    const activeItem = state.items.find((i) => i.id === state.activeItemId) || null;
    return activeItem?.sourceCanvas || null;
  });
  const setResultCanvas = useWorkspace((state) => state.setResultCanvas);
  const setIsProcessing = useWorkspace((state) => state.setIsProcessing);
  const { updateProgress, showToast } = useUI();

  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleSelect = async (idx) => {
    if (!segmentationResult?.options) return;

    setSelectedIndex(idx);
    const candidate = segmentationResult.options[idx];
    const mode = segmentationResult.mode;

    setIsProcessing(true);
    updateProgress(0.9, "Generating high-res preview...");

    try {
      const renderedCanvas = await candidate.render(originalCanvas, mode);
      setResultCanvas(renderedCanvas);
    } catch (err) {
      console.error("[SAM] Failed to render candidate:", err);
      showToast("Render failed", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Render first candidate on initial load
  useEffect(() => {
    if (segmentationResult?.options?.length > 0) {
      handleSelect(0);
    }
  }, [segmentationResult]);

  // Early return comes AFTER all top-level hooks
  if (!segmentationResult || !segmentationResult.options) {
    return null;
  }

  const candidates = segmentationResult.options;

  return (
    <div className="segmentation-picker">
      <div className="segmentation-picker-label">Select Subject Candidate</div>
      <div className="segmentation-layers-container">
        {candidates.map((candidate, idx) => (
          <CandidateCard
            key={idx}
            candidate={candidate}
            idx={idx}
            isSelected={idx === selectedIndex}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(SegmentationCandidates);
