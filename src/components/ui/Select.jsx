import React from "react";

/**
 * Premium Select Component
 */
const Select = ({ label, options = [], value, onChange, disabled = false }) => {
  return (
    <div
      className={`premium-select-container ${disabled ? "is-disabled" : ""}`}
    >
      {label && <label className="select-label">{label}</label>}
      <div className="select-wrapper">
        <select
          className="premium-select-input"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="select-chevron">
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Select);
