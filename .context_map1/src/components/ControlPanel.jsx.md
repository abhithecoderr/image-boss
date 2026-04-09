**Purpose:**

Renders the specific controls and model selector dropdown for various ai services and process button.
Manages the serviceSettings state variable to provide all selected values for a given service to App.jsx through onProcess prop

Utilises the CONTROLS_CONFIG state in config.js to fetch all controls for a given service


**Code structure:**

*Imports*

```js
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useSAM } from '../hooks/useSAM';
```

*ControlPanel component*

```js
const ControlPanel = ({ onProcess }) => {
  const { currentService, editing, setEditing, serviceSettings, updateServiceSetting } = useApp();
  const { clearPoints, executeSmartSelect } = useSAM();

  const handleProcess = () => {
    if (currentService.id === 'object-segmentation') {
      executeSmartSelect();
    } else {
      onProcess(values);
    }
  };
```

*UseEffect to set default slider values*

```js
 // Reset values when service changes
  useEffect(() => {
    // Default values based on config or known service needs
    const defaults = {};
    if (currentService.id === 'background-removal') {
      defaults.threshold = 0.5;
      defaults.feathering = 0;
    } else if (currentService.id === 'upscaling') {
      defaults.scale = 2;
    }
    setValues(defaults);
  }, [currentService]);

  const handleChange = (id, val) => {
    setValues(prev => ({ ...prev, [id]: val }));
  };
  ```

*renderControl function that renders all controls for the specific service (dropdowns, sliders, text input fields, etc)*

  Accepts a control and settings input parameter, control is the specific individual control and settings contains the current value for that control

```js
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
  ```

*renderServiceSpecific function to dynamically render control panel ui for specific selected service*


Followed by a final return block which calls the renderServiceSpecific function and some more manual control tools*


