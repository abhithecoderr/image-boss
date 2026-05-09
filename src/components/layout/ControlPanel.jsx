import { useService, useWorkspace } from "../../context/AppContext";
import { useAppEngine } from "../../hooks/useAppEngine";
import { useSAM } from "../../hooks/useSAM";
import { OPERATION_MODE } from "../../config/app";
import { CONTROLS_CONFIG } from "../../config/controls";
import React from "react";
import ManualTouchupControls from "../shared/ManualTouchupControls";
import ServiceControlGrid from "../shared/ServiceControlGrid";

const ControlPanel = () => {
  const {
    currentService,
    serviceSettings,
    updateServiceSetting,
  } = useService();
  const {
    originalCanvas,
    resultCanvas
  } = useWorkspace();
  const { executeSmartSelect } = useSAM();
  const { execute, engine: batch, mode } = useAppEngine();

  const activeMode = mode;

  const handleControlChange = (id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;
    updateServiceSetting(currentService.id, id, parsedVal);
  };

  const showManualTouchup = ['background-removal', 'object-segmentation'].includes(currentService.id);

  const getProcessAction = () => {
    if (currentService.id === 'object-segmentation') return executeSmartSelect;

    if (activeMode === OPERATION_MODE.BATCH) {
      const pending = batch.items.filter(i => i.status === 'pending' || i.status === 'error').length;
      if (pending > 0) {
        return () => execute(serviceSettings[currentService.id]);
      } else if (batch.items.length > 0) {
        return () => batch.rerunAll(serviceSettings[currentService.id]);
      }
    }

    return () => execute(serviceSettings[currentService.id]);
  };

  const getProcessLabel = () => {
    if (currentService.id === 'object-segmentation') return '🎯 Segment Selected Points';

    if (activeMode === OPERATION_MODE.BATCH) {
      const pending = batch.items.filter(i => i.status === 'pending' || i.status === 'error').length;
      if (pending > 0) {
        return `🚀 Process All (${pending} image${pending !== 1 ? 's' : ''})`;
      } else if (batch.items.length > 0) {
        return `🔄 Rerun All (${batch.items.length} images)`;
      }
    }
    return '🚀 Process Image';
  };

  return (
    <div className="controls">
      <div className="controls-grid">
        {batch.batchAvailable && (
          <div className="control-group">
            <label className="control-label">Mode</label>
            <select
              className="control-select"
              value={batch.mode}
              onChange={(e) => batch.setMode(e.target.value)}
            >
              <option value="single">Single</option>
              <option value="batch">Batch</option>
            </select>
          </div>
        )}

        <ServiceControlGrid
          serviceId={currentService.id}
          options={serviceSettings[currentService.id]}
          onChange={handleControlChange}
          sourceCanvas={originalCanvas}
          resultCanvas={resultCanvas}
        />

        {activeMode === OPERATION_MODE.BATCH && batch.items.length > 0 && (
          <div className="control-group" style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            <label className="control-label">Batch Actions</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-secondary btn-tiny" onClick={batch.selectAllItems}>Select All</button>
              <button className="btn btn-secondary btn-tiny" onClick={batch.deselectAllItems}>Deselect All</button>
              <button
                className="btn btn-secondary btn-tiny"
                onClick={() => {
                   if (confirm('Clear all batch results? This marks them as pending for rerunning.')) {
                     batch.rerunAll(serviceSettings[currentService.id]);
                   }
                 }}
              >
                ♻️ Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {showManualTouchup && <ManualTouchupControls />}

      <div className="actions-row">
        <button
          className="btn btn-primary btn-large"
          onClick={getProcessAction()}
          disabled={activeMode === OPERATION_MODE.BATCH && batch.items.length === 0}
        >
          {getProcessLabel()}
        </button>
      </div>
    </div>
  );
};

export default React.memo(ControlPanel);

