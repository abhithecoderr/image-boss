import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Sub-component for individual candidate cards to safely use hooks
 */
const CandidateCard = ({ candidate, idx, isSelected, onSelect }) => {
  const thumbRef = useRef(null);

  useEffect(() => {
    if (thumbRef.current) {
      const thumb = candidate.getThumbnail();
      thumbRef.current.innerHTML = '';
      thumbRef.current.appendChild(thumb);
    }
  }, [candidate]);

  return (
    <div
      className={`candidate-card ${isSelected ? 'is-selected' : ''}`}
      onClick={() => onSelect(idx)}
    >
      <div ref={thumbRef} className="layer-thumb-canvas" />
      <div className="candidate-label">
        Option {idx + 1}
      </div>
    </div>
  );
};

const SegmentationCandidates = () => {
  const {
    segmentationResult,
    originalCanvas,
    setResultCanvas,
    updateProgress,
    setIsProcessing,
    showToast
  } = useApp();

  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleSelect = async (idx) => {
    if (!segmentationResult?.options) return;

    setSelectedIndex(idx);
    const candidate = segmentationResult.options[idx];
    const mode = segmentationResult.mode;

    setIsProcessing(true);
    updateProgress(0.9, 'Generating high-res preview...');

    try {
      const renderedCanvas = await candidate.render(originalCanvas, mode);
      setResultCanvas(renderedCanvas);
    } catch (err) {
      console.error('[SAM] Failed to render candidate:', err);
      showToast('Render failed', 'error');
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

export default SegmentationCandidates;
