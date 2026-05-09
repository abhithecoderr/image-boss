import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, matchPath } from 'react-router-dom';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';
import { CONTROLS_CONFIG } from '../config/controls';
import { useWorkspace } from './WorkspaceContext';

const ServiceContext = createContext();

export const ServiceProvider = ({ children }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  
  // Manually match the path since this provider is a parent of the Routes
  const match = matchPath("/services/:serviceId", pathname);
  const serviceId = match?.params?.serviceId;

  const { resultCanvas, setResultCanvas, originalFile } = useWorkspace();

  
  // URL as source of truth for active service
  const currentService = useMemo(() => {
    return SERVICES[serviceId] || SERVICES[SERVICE_ORDER[0]];
  }, [serviceId]);
  
  const [serviceSettings, setServiceSettings] = useState(() => {
    const initial = {};
    Object.keys(CONTROLS_CONFIG).forEach(sId => {
      initial[sId] = {};
      CONTROLS_CONFIG[sId].forEach(control => {
        if (control.defaultValue !== undefined) {
          initial[sId][control.id] = control.defaultValue;
        }
      });
    });
    return initial;
  });

  const [serviceResults, setServiceResults] = useState({});
  const serviceResultsRef = useRef(serviceResults);
  const prevServiceIdRef = useRef(serviceId);

  const [samPoints, setSamPointsLocal] = useState([]);
  const [samPointLabel, setSamPointLabel] = useState(1);
  const [editing, setEditing] = useState({
    activeTool: 'none', activeMode: 'extract', brushSize: 30, isDrawing: false,
  });
  const [activeEditorTab, setActiveEditorTab] = useState('composition');
  const [segmentationResult, setSegmentationResultLocal] = useState(null);

  const latestStateRef = useRef({ resultCanvas, segmentationResult, samPoints });
  useEffect(() => {
    latestStateRef.current = { resultCanvas, segmentationResult, samPoints };
  }, [resultCanvas, segmentationResult, samPoints]);

  // --- Automatic State Persistence & Hydration ---
  useEffect(() => {
    const prevId = prevServiceIdRef.current;
    const nextId = serviceId || SERVICE_ORDER[0];

    // 1. Swap AI models immediately to free GPU memory
    import('../core/worker-registry').then(({ workerRegistry }) => {
      workerRegistry.activate(nextId);
    });

    if (prevId === nextId) return;

    // 2. Snapshot the PREVIOUS service state before we lose it
    const snapshot = { ...latestStateRef.current };

    // 3. Update the buffer - we only keep the active service's results in the actual state
    // to prevent massive memory accumulation across all services.
    setServiceResults(prev => {
      // Cleanup: Dispose of any canvases that are NOT the one we just snapshotted (prevId)
      // and NOT the one we are about to hydrate (nextId).
      Object.entries(prev).forEach(([id, state]) => {
        if (id !== prevId && id !== nextId) {
          if (state.resultCanvas?.close) state.resultCanvas.close();
          if (state.segmentationResult?.canvas?.close) state.segmentationResult.canvas.close();
        }
      });
      return { [prevId]: snapshot };
    });
    serviceResultsRef.current[prevId] = snapshot;

    // 4. Hydrate the NEXT service state from the buffer
    const nextResults = serviceResultsRef.current[nextId] || {};
    setResultCanvas(nextResults.resultCanvas || null);
    setSegmentationResultLocal(nextResults.segmentationResult || null);
    setSamPointsLocal(nextResults.samPoints || []);

    prevServiceIdRef.current = nextId;
  }, [serviceId, setResultCanvas]);

  const updateServiceSetting = useCallback((sId, settingId, value) => {
    setServiceSettings(prev => ({
      ...prev,
      [sId]: { ...prev[sId], [settingId]: value }
    }));
  }, []);

  const resetServiceState = useCallback(() => {
    setSamPointsLocal([]);
    setSamPointLabel(1);
    setEditing({
      activeTool: 'none',
      activeMode: 'extract',
      brushSize: 30,
      isDrawing: false,
    });
    setActiveEditorTab('composition');
    setSegmentationResultLocal(null);
    setServiceResults({});
  }, []);

  const selectService = useCallback((targetServiceId) => {
    navigate(`/services/${targetServiceId}`);
  }, [navigate]);


  const getDownloadMetadata = useCallback((item = null, overrideServiceId = null, resultCanvasArg = null) => {
    const canvas = resultCanvasArg || item?.resultCanvas || resultCanvas;
    const sourceFile = item?.file || originalFile;
    if (!sourceFile) return { filename: `result_${Date.now()}.png`, mimeType: 'image/png' };

    const baseName = sourceFile.name.replace(/\.[^/.]+$/, '');
    const activeServiceId = overrideServiceId || currentService.id;
    let mimeType = sourceFile.type || 'image/png';

    if (canvas?._resultMimeType) {
      mimeType = canvas._resultMimeType;
    } else if (canvas?._compressedMimeType) {
      mimeType = canvas._compressedMimeType;
    } else if (canvas?.dataset?.format) {
      mimeType = canvas.dataset.format;
    } else if (activeServiceId === 'background-removal') {
      mimeType = 'image/png';
    } else if (activeServiceId === 'file-conversion') {
      mimeType = serviceSettings['file-conversion']?.format || 'image/png';
    }

    const mimeMap = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/avif': 'avif', 'image/bmp': 'bmp', 'image/gif': 'gif',
      'image/tiff': 'tiff', 'image/x-icon': 'ico', 'image/x-portable-anymap': 'pbm',
      'application/pdf': 'pdf', 'text/plain': 'txt'
    };

    const extension = mimeMap[mimeType] || mimeType.split('/')[1] || 'png';

    return {
      filename: `${baseName}_${activeServiceId}.${extension}`,
      mimeType
    };
  }, [originalFile, currentService.id, serviceSettings, resultCanvas]);

  const value = useMemo(() => ({
    currentService,
    serviceSettings, setServiceSettings,
    updateServiceSetting, serviceResults, setServiceResults,
    samPoints, setSamPoints: setSamPointsLocal, samPointLabel, setSamPointLabel,
    editing, setEditing, activeEditorTab, setActiveEditorTab,
    segmentationResult, setSegmentationResult: setSegmentationResultLocal, resetServiceState,
    selectService, getDownloadMetadata
  }), [
    currentService, serviceSettings, serviceResults, updateServiceSetting,
    samPoints, samPointLabel, editing, activeEditorTab, segmentationResult, resetServiceState,
    selectService, getDownloadMetadata
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

