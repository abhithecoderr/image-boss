import React from 'react';

/**
 * ControlRenderer — Generic UI component for service settings.
 * Renders an input based on the 'type' field in the config.
 */
const ControlRenderer = ({ control, value, onChange }) => {
  if (control.disabled) return null;

  return (
    <div className="control-group" key={control.id}>
      <label className="control-label">
        {control.label} {control.type === 'range' && `: ${value}`}
      </label>
      
      {control.type === 'select' && (
        <select
          className="control-select"
          value={value}
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
          onChange={(e) => onChange(control.id, e.target.value)}
          style={{ 
            width: '100%', 
            padding: '8px', 
            background: '#222', 
            border: '1px solid #333', 
            borderRadius: '4px', 
            color: '#fff' 
          }}
        />
      )}
      
      {control.type === 'toggle' && (
        <button 
          className={`btn btn-secondary ${value ? 'active' : ''}`}
          onClick={() => onChange(control.id, !value)}
          style={{ width: '100%' }}
        >
          {value ? '✅ ' : '❌ '} {control.label}
        </button>
      )}
    </div>
  );
};

export default ControlRenderer;
