import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace, useService, useUI } from '../../store';
import { useUnifiedProcessor as useController } from '../../hooks/useUnifiedProcessor';
import { CONTROLS_CONFIG } from '../../config/controls';
import { SERVICE_ORDER } from '../../config/app';
import { SERVICES } from '../../config/services';
import UploadZone from '../ui/UploadZone';
import Select from '../ui/Select';
import Button from '../ui/Button';

/* 
 HomeSandbox:
 The playground dashboard sandbox (Mockup 1).
 Coordinates file drop queues, AI service selectors, and auto-navigates to the workspace.
*/
export default function HomeSandbox() {
  const navigate = useNavigate();
  const showToast = useUI((state) => state.showToast);
  const { 
    items, 
    activeItemId,
    batchMode
  } = useWorkspace();

  const { 
    currentService, 
    serviceSettings,
    updateServiceSetting
  } = useService();

  const { addFiles, setMode } = useController();

  // Keep selected service local to prevent premature redirection
  const [selectedServiceId, setSelectedServiceId] = useState(currentService.id || SERVICE_ORDER[0]);

  // Active queued item details for thumbnail/preview
  const activeItem = items.find(i => i.id === activeItemId) || null;

  const handleServiceChange = (val) => {
    if (val === 'magic-erase' || val === 'object-segmentation' || val === 'image-editor') {
      navigate(`/services/${val}`);
    } else {
      setSelectedServiceId(val);
    }
  };

  // Navigates directly to workspace with autoprocess flags set
  const handleProcessClick = () => {
    if (items.length === 0) {
      showToast('Please upload an image first', 'warning');
      return;
    }
    showToast('Redirecting to Workspace...', 'success');
    navigate(`/services/${selectedServiceId}`, { state: { autoProcess: true } });
  };


  // Extract model/variant selection controls for the current service
  const configs = CONTROLS_CONFIG[selectedServiceId] || [];
  const modelControls = configs.filter(c => 
    c.type === 'select' && 
    (c.id === 'model' || c.id === 'modelId' || c.id === 'variant' || c.id === 'aiVariant' || c.id === 'method') &&
    (!c.visibleIf || c.visibleIf(serviceSettings[selectedServiceId] || {}))
  );

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
            value={selectedServiceId}
            onChange={handleServiceChange}
          />
        </div>

        {modelControls.map(control => {
          const value = serviceSettings[selectedServiceId]?.[control.id] ?? control.defaultValue;
          const resolvedOptions = typeof control.options === "function"
            ? control.options(serviceSettings[selectedServiceId] || {})
            : (control.options || []);

          return (
            <div key={control.id} className="sandbox-control-item">
              <label className="sandbox-control-label">{control.label}</label>
              <Select
                options={resolvedOptions}
                value={value}
                onChange={(val) => updateServiceSetting(selectedServiceId, control.id, control.parse ? control.parse(val) : val)}
              />
            </div>
          );
        })}

        <div className="sandbox-control-item">
          <label className="sandbox-control-label">Mode</label>
          <Select
            options={[
              { value: "single", label: "Single Image" },
              { value: "batch", label: "Batch Queue" },
            ]}
            value={batchMode}
            onChange={(val) => setMode(val)}
          />
        </div>
      </div>

      {/* 3. Process Action Button */}
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



