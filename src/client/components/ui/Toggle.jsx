import React from 'react';

/**
 * Premium Toggle/Switch Component
 */
const Toggle = ({
  label,
  value,
  onChange,
  disabled = false
}) => {
  return (
    <div className={`premium-toggle-container ${disabled ? 'is-disabled' : ''}`}>
      {label && <label className="toggle-label">{label}</label>}
      <button
        className={`premium-toggle-switch ${value ? 'is-active' : ''}`}
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        type="button"
      >
        <div className="toggle-thumb">
          {value ? (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
        </div>
        <span className="toggle-text">{value ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
};

export default Toggle;
