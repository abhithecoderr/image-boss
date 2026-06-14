import React, { useRef } from 'react';

/**
 * Premium Slider Component
 * Features +/- buttons and ruler-style tick marks.
 */
const Slider = ({
  label,
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  disabled = false,
  unit = ''
}) => {
  const rulerRef = useRef(null);

  const handleIncrement = () => {
    const newValue = Math.min(max, parseFloat(value) + step);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, parseFloat(value) - step);
    onChange(newValue);
  };

  const handleSliderChange = (e) => {
    onChange(parseFloat(e.target.value));
  };

  // Calculate percentage for gradient background
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`premium-slider-container ${disabled ? 'is-disabled' : ''}`}>
      <div className="slider-header">
        <label className="slider-label">{label}</label>
        <span className="slider-value-display">
          {value}{unit}
        </span>
      </div>

      <div className="slider-controls-row">
        <button
          type="button"
          className="slider-step-btn"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          title="Decrease"
        >
          −
        </button>

        <div className="slider-track-wrapper">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleSliderChange}
            disabled={disabled}
            className="premium-slider-input"
            style={{ '--percentage': `${percentage}%` }}
          />

          <div className="slider-ruler" ref={rulerRef}>
            {[...Array(11)].map((_, i) => (
              <div
                key={i}
                className={`ruler-mark ${i % 5 === 0 ? 'major' : 'minor'}`}
                style={{ left: `${i * 10}%` }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          className="slider-step-btn"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          title="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default Slider;
