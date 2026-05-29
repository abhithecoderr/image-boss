import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace, useService, useUI } from '../../context/AppContext';
import { useUnifiedProcessor } from '../../hooks/useUnifiedProcessor';
import { CONTROLS_CONFIG } from '../../config/controls';
import { SERVICE_ORDER } from '../../config/app';
import { SERVICES } from '../../config/services';
import UploadZone from '../ui/UploadZone';
import Select from '../ui/Select';
import Slider from '../ui/Slider';
import Button from '../ui/Button';

/* 
 HomeSandbox:
 The playground dashboard sandbox (Mockup 1).
 Coordinates file drop queues, AI service selectors, and custom parameters drawers.
*/
export default function HomeSandbox() {
  const navigate = useNavigate();
  const { showToast } = useUI();
  const { 
    items, 
    activeItemId,
    batchMode,
    setBatchMode
  } = useWorkspace();

  const { 
    currentService, 
    selectService, 
    serviceSettings, 
    updateServiceSetting 
  } = useService();

  const { addFiles } = useUnifiedProcessor();

  // Toggle collapsible settings drawer (starts open)
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Active queued item details for thumbnail/preview
  const activeItem = items.find(i => i.id === activeItemId) || null;

  // Fetch AI options config dynamically for currently active service
  const configs = CONTROLS_CONFIG[currentService.id] || [];

  // Navigates directly to workspace with autoprocess flags set
  const handleProcessClick = () => {
    if (items.length === 0) {
      showToast('Please upload an image first', 'warning');
      return;
    }
    showToast('Redirecting to Workspace...', 'success');
    navigate(`/services/${currentService.id}`, { state: { autoProcess: true } });
  };

  return (
    <div className="home-sandbox-container">
      {/* 1. Drag & Drop Upload Container */}
      <UploadZone
        multiple={batchMode === 'batch'}
        activeItem={activeItem}
        onFilesSelected={addFiles}
        className="sandbox-upload-box"
      />

      {/* 2. Parameters Selectors Bar */}
      <div className="sandbox-controls-bar">
        <div className="sandbox-control-item">
          <label className="sandbox-control-label">Select Service</label>
          <Select
            options={SERVICE_ORDER.filter(id => !SERVICES[id].disabled).map(id => ({
              value: id,
              label: SERVICES[id].name,
            }))}
            value={currentService.id}
            onChange={(val) => selectService(val)}
          />
        </div>

        <div className="sandbox-control-item">
          <label className="sandbox-control-label">Mode</label>
          <Select
            options={[
              { value: "single", label: "Single Image" },
              { value: "batch", label: "Batch Queue" },
            ]}
            value={batchMode}
            onChange={(val) => setBatchMode(val)}
          />
        </div>

        <div className="sandbox-control-item">
          <label className="sandbox-control-label">Speed Mode</label>
          <Select
            options={[
              { value: "normal", label: "Normal (Accurate)" },
              { value: "fast", label: "Fast (Turbo)" },
            ]}
            value="fast"
            onChange={() => {}}
          />
        </div>
      </div>

      {/* 3. Collapsible Parameter Drawer */}
      <div className="sandbox-settings-drawer">
        <div 
          className="sandbox-drawer-header"
          onClick={() => setDrawerOpen(!drawerOpen)}
        >
          <span className="sandbox-drawer-title">
            Customize parameters ({currentService.name})
          </span>
          <span className={`sandbox-drawer-toggle-icon ${drawerOpen ? 'open' : ''}`}>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m1 1 4 4 4-4" />
            </svg>
          </span>
        </div>

        {drawerOpen && (
          <div className="sandbox-drawer-content">
            {configs.length === 0 ? (
              <div className="sandbox-drawer-empty">
                This service executes automatically with standard model defaults.
              </div>
            ) : (
              configs.map(control => {
                const value = serviceSettings[currentService.id]?.[control.id] ?? control.defaultValue;
                return (
                  <div key={control.id} className="sandbox-control-item" style={{ gap: '6px' }}>
                    {control.type === 'range' ? (
                      <Slider
                        label={control.label}
                        min={control.min}
                        max={control.max}
                        step={control.step || 1}
                        value={value}
                        onChange={(val) => updateServiceSetting(currentService.id, control.id, val)}
                      />
                    ) : (
                      <>
                        <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>
                          {control.label}
                        </label>
                        <Select
                          options={control.options}
                          value={value}
                          onChange={(val) => updateServiceSetting(currentService.id, control.id, control.parse ? control.parse(val) : val)}
                        />
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 4. Process Action Button */}
      <div className="sandbox-action-row">
        <Button 
          variant="primary"
          size="large"
          className="sandbox-process-btn"
          onClick={handleProcessClick}
          disabled={items.length === 0}
        >
          Process in Workspace
        </Button>
      </div>
    </div>
  );
}
