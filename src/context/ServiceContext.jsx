import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { CONTROLS_CONFIG } from '../config/controls';
import { useWorkspace } from './WorkspaceContext';
import { useServiceEngine } from '../hooks/useServiceEngine';
import { getDownloadMetadata as calculateMetadata } from '../core/canvas-utils';

// Context storing configurations, active sliders, and execution references for AI tasks
const ServiceContext = createContext();

/* 
 ServiceProvider:
 Coordinates options, default initializers, slider values, and download configurations
 for all AI processing models (such as RMBG, YOLO Blur, upscale limits).
*/
export const ServiceProvider = ({ children }) => {
  const { resultCanvas, setResultCanvas, originalFile } = useWorkspace();

  // Encapsulates engine-level worker routines, dynamic importing, and memory eviction
  const {
    currentService,
    serviceId,
    serviceResults,
    setServiceResults,
    selectService
  } = useServiceEngine(resultCanvas, setResultCanvas);

  // Key-value store maps serviceId to active slider/parameter preferences (e.g. {'upscaling': {'scale': 1.5}})
  const [serviceSettings, setServiceSettings] = useState({});

  // Initialize service settings lazily with defaults defined in the CONTROLS_CONFIG
  useEffect(() => {
    if (!serviceSettings[serviceId] && CONTROLS_CONFIG[serviceId]) {
      const defaults = {};
      CONTROLS_CONFIG[serviceId].forEach(control => {
        if (control.defaultValue !== undefined) {
          defaults[control.id] = control.defaultValue;
        }
      });
      setServiceSettings(prev => ({ ...prev, [serviceId]: defaults }));
    }
  }, [serviceId, serviceSettings]);

  // Updates a single settings option for an AI service (triggered by sliders or dropdowns)
  const updateServiceSetting = useCallback((sId, settingId, value) => {
    setServiceSettings(prev => ({
      ...prev,
      [sId]: { ...prev[sId], [settingId]: value }
    }));
  }, []);

  // Resets calculated results and removes viewport canvases
  const resetServiceState = useCallback(() => {
    setServiceResults({});
    setResultCanvas(null);
  }, [setResultCanvas, setServiceResults]);

  // Calculates download attributes (file format, output suffix, mime-type) dynamically based on active settings
  const getDownloadMetadata = useCallback((item = null, overrideServiceId = null, resultCanvasArg = null) => {
    const canvas = resultCanvasArg || item?.resultCanvas || resultCanvas;
    const sourceFile = item?.file || originalFile;
    const activeServiceId = overrideServiceId || currentService.id;

    return calculateMetadata(canvas, sourceFile, activeServiceId, serviceSettings);
  }, [originalFile, currentService.id, serviceSettings, resultCanvas]);

  const value = useMemo(() => ({
    currentService,
    serviceSettings, setServiceSettings,
    updateServiceSetting, serviceResults, setServiceResults,
    resetServiceState, selectService, getDownloadMetadata
  }), [
    currentService, serviceSettings, serviceResults, updateServiceSetting,
    resetServiceState, selectService, getDownloadMetadata, setServiceResults
  ]);

  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  );
};

export const useService = () => {
  const context = useContext(ServiceContext);
  if (!context) throw new Error('useService must be used within a ServiceProvider');
  return context;
};
