import React from "react";

/**
 * Standardized Premium Minimal Progress Component
 */
const Progress = ({ percent = 0, message = "Processing..." }) => {
  // Normalize percent to 0-100% scale
  const normalizedPercent = Math.min(100, Math.max(0, percent * 100));

  return (
    <div className="status-bar">
      <div className="progress-container">
        <div
          className="progress-fill"
          style={{ width: `${normalizedPercent}%` }}
        />
      </div>
      <div className="progress-text">{message}</div>
    </div>
  );
};

export default Progress;
