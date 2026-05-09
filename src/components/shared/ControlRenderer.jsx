import React from 'react';

/**
 * ControlRenderer — Generic UI component for service settings.
 * Renders an input based on the 'type' field in the config.
 */
const ControlRenderer = ({ control, value, onChange }) => {
  const isDisabled = control.disabled;

  return (
    <div className={`control-group ${isDisabled ? 'control-disabled' : ''}`} key={control.id}>
      <label className="control-label">{control.label}</label>
      
      {control.type === 'select' && (
        <select
          className="control-select"
          value={value}
          disabled={isDisabled}
          onChange={(e) => onChange(control.id, e.target.value, control.parse)}
        >
          {control.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      
      {control.type === 'range' && (
        <div className="range-with-value">
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={value}
            disabled={isDisabled}
            onChange={(e) => onChange(control.id, e.target.value, parseFloat)}
            className="control-input"
          />
          <span className="range-value">{value}</span>
        </div>
      )}
      
      {control.type === 'text' && (
        <input
          type="text"
          className="control-input"
          placeholder={control.placeholder}
          value={value || ''}
          disabled={isDisabled}
          onChange={(e) => onChange(control.id, e.target.value)}
        />
      )}
      
      {control.type === 'toggle' && (
        <button 
          className={`btn btn-secondary toggle-btn ${value ? 'active' : ''}`}
          disabled={isDisabled}
          onClick={() => onChange(control.id, !value)}
        >
          {value ? 'ON' : 'OFF'}
        </button>
      )}
    </div>
  );
};

export default ControlRenderer;
