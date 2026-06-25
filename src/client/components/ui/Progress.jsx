import React from "react";

/**
 * Standardized Premium Minimal Progress Component
 */
const Progress = ({ percent = 0, message = "Processing...", stage = "processing" }) => {
  const isIndeterminate = stage === "initializing";
  // Normalize percent: support both 0-1 and 0-100 scales safely
  const normalizedPercent = isIndeterminate 
    ? 100 
    : Math.min(100, Math.max(0, percent > 1 ? percent : percent * 100));

  return (
    <div className="status-bar">
      <div className={`progress-container ${isIndeterminate ? "is-indeterminate" : ""}`}>
        <div
          className={`progress-fill ${isIndeterminate ? "is-indeterminate" : ""}`}
          style={{ width: `${normalizedPercent}%` }}
        />
      </div>
      <div className="progress-text">{message}</div>
    </div>
  );
};

export default Progress;
