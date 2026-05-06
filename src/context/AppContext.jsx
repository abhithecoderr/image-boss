import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';
import { CONTROLS_CONFIG } from '../config/controls';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // --- UI State ---
  const [toast, setToast] = useState(null);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const updateProgress = useCallback((percent, message) => {
    setProgress({ percent, message });
  }, []);

  // --- Image State ---
  const [originalImage, setOriginalImage] = useState(null);
  const [originalCanvas, setOriginalCanvas] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [resultCanvas, setResultCanvas] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const resetImages = useCallback(() => {
    setOriginalImage(null);
    setOriginalCanvas(null);
    setOriginalFile(null);
    setResultCanvas(null);
    setIsProcessing(false);
  }, []);

  // --- Service State ---
  const [currentService, setCurrentService] = useState(SERVICES[SERVICE_ORDER[0]]);
  
  const [serviceSettings, setServiceSettings] = useState(() => {
    const initial = {};
    Object.keys(CONTROLS_CONFIG).forEach(serviceId => {
      initial[serviceId] = {};
      CONTROLS_CONFIG[serviceId].forEach(control => {
        if (control.defaultValue !== undefined) {
          initial[serviceId][control.id] = control.defaultValue;
        }
      });
    });
    return initial;
  });

  const [serviceResults, setServiceResults] = useState({});
  const serviceResultsRef = useRef(serviceResults);
  const [samPoints, setSamPoints] = useState([]);
  const [samPointLabel, setSamPointLabel] = useState(1);
  const [editing, setEditing] = useState({
    activeTool: 'none',
    activeMode: 'extract',
    brushSize: 30,
    isDrawing: false,
  });
  const [activeEditorTab, setActiveEditorTab] = useState('composition');
  const [segmentationResult, setSegmentationResult] = useState(null);

  useEffect(() => {
    serviceResultsRef.current = serviceResults;
  }, [serviceResults]);

  const updateServiceSetting = useCallback((serviceId, settingId, value) => {
    setServiceSettings(prev => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], [settingId]: value }
    }));
  }, []);

  const resetServiceState = useCallback(() => {
    setSamPoints([]);
    setSamPointLabel(1);
    setEditing({
      activeTool: 'none',
      activeMode: 'extract',
      brushSize: 30,
      isDrawing: false,
    });
    setActiveEditorTab('composition');
    setSegmentationResult(null);
    setServiceResults({});
  }, []);

  // --- Orchestration Logic ---
  const selectService = useCallback((serviceId) => {
    const currentSnapshot = {
      resultCanvas,
      segmentationResult,
      samPoints
    };

    // 1. Capture current state for persistence
    setServiceResults(prev => ({
      ...prev,
      [currentService.id]: currentSnapshot
    }));

    // 2. Hydrate next service state
    const nextResults = serviceResultsRef.current[serviceId] || {};
    setResultCanvas(nextResults.resultCanvas || null);
    setSegmentationResult(nextResults.segmentationResult || null);
    setSamPoints(nextResults.samPoints || []);

    setCurrentService(SERVICES[serviceId]);
  }, [currentService.id, resultCanvas, segmentationResult, samPoints]);

  const resetWorkspace = useCallback(() => {
    resetImages();
    updateProgress(0, '');
    resetServiceState();
  }, [resetImages, updateProgress, resetServiceState]);

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
    // UI
    toast, progress, showToast, updateProgress,
    // Images
    originalImage, setOriginalImage, originalCanvas, setOriginalCanvas,
    originalFile, setOriginalFile, resultCanvas, setResultCanvas,
    isProcessing, setIsProcessing, resetImages,
    // Service
    currentService, setCurrentService, serviceSettings, setServiceSettings,
    updateServiceSetting, serviceResults, setServiceResults,
    samPoints, setSamPoints, samPointLabel, setSamPointLabel,
    editing, setEditing, activeEditorTab, setActiveEditorTab,
    segmentationResult, setSegmentationResult, resetServiceState,
    // Orchestration
    selectService, resetWorkspace, getDownloadMetadata
  }), [
    toast, progress, showToast, updateProgress,
    originalImage, originalCanvas, originalFile, resultCanvas, isProcessing, resetImages,
    currentService, serviceSettings, serviceResults, updateServiceSetting,
    samPoints, samPointLabel, editing, activeEditorTab, segmentationResult, resetServiceState,
    selectService, resetWorkspace, getDownloadMetadata
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

// Fallback exports for backward compatibility during refactor
export const useUI = useApp;
export const useImages = useApp;
export const useService = useApp;
