import React from 'react';
import { useApp } from '../context/AppContext';
import { useSAM } from '../hooks/useSAM';
import { CONTROLS_CONFIG } from '../config';

const ControlPanel = ({ onProcess }) => {
  const { currentService, editing, setEditing, serviceSettings, updateServiceSetting } = useApp();
  const { clearPoints, executeSmartSelect } = useSAM();

  const handleProcess = () => {
    if (currentService.id === 'object-segmentation') {
      executeSmartSelect();
    } else {
      onProcess(serviceSettings[currentService.id]);
    }
  };

  const handleChange = (id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;
    updateServiceSetting(currentService.id, id, parsedVal);
  };

  const renderControl = (control, settings) => {
    if (control.visibleIf && !control.visibleIf(settings)) return null;

    const value = settings[control.id];

    return (
      <div className="control-group" key={control.id}>
        <label className="control-label">{control.label} {control.type === 'range' && `: ${value}`}</label>
        {control.type === 'select' && (
          <select
            className="control-select"
            value={value}
            onChange={(e) => handleChange(control.id, e.target.value, control.parse)}
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
              onChange={(e) => handleChange(control.id, e.target.value, parseFloat)}
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
            onChange={(e) => handleChange(control.id, e.target.value)}
            style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #333', borderRadius: '4px', color: '#fff' }}
          />
        )}
      </div>
    );
  };

  const renderServiceSpecific = () => {

    //configs contain the specific control metadata and settings contain the values for those controls in the given service
    
    const configs = CONTROLS_CONFIG[currentService.id];
    const settings = serviceSettings[currentService.id] || {};

    if (!configs) {
      return <p className="control-hint">No specialized settings for this service.</p>;
    }

    return (
      <>
        {configs.map(config => renderControl(config, settings))}

        {currentService.id === 'object-segmentation' && (
          <>

            <div className="control-group" style={{ alignItems: 'flex-end' }}>
              <button className="btn btn-secondary btn-tiny" onClick={clearPoints}>Clear Selection</button>
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <div className="controls">
      <div className="controls-grid">
        {renderServiceSpecific()}
      </div>

      {/* Manual Editing Tools */}
      <div className="control-group control-section-divider">
        <label className="control-label" style={{ marginBottom: '12px' }}>Manual Mask Touch-up</label>
        <div className="control-manual-touchup">
          <div className="tab-group control-tabs">
            <button
              className={`btn btn-secondary ${editing.activeTool === 'none' ? 'active' : ''}`}
              onClick={() => setEditing(prev => ({ ...prev, activeTool: 'none' }))}
            >
              ✋ Move
            </button>
            <button
              className={`btn btn-secondary ${editing.activeTool === 'erase' ? 'active' : ''}`}
              onClick={() => setEditing(prev => ({ ...prev, activeTool: 'erase' }))}
            >
              🧽 Erase
            </button>
            <button
              className={`btn btn-secondary ${editing.activeTool === 'restore' ? 'active' : ''}`}
              onClick={() => setEditing(prev => ({ ...prev, activeTool: 'restore' }))}
            >
              🖌️ Restore
            </button>
          </div>

          {editing.activeTool !== 'none' && (
            <div className="control-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="control-label">Brush Size</label>
              <div className="range-with-value">
                <input
                  type="range"
                  min="5" max="150" step="5"
                  value={editing.brushSize}
                  onChange={(e) => setEditing(prev => ({ ...prev, brushSize: parseInt(e.target.value) }))}
                  className="control-input"
                />
                <span className="range-value">{editing.brushSize}px</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="actions-row">
        <button
          className="btn btn-primary btn-large"
          onClick={handleProcess}
          disabled={false}
        >
          {currentService.id === 'object-segmentation' ? '🎯 Segment Selected Points' : '🚀 Process Image'}
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
