import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { SERVICES, SERVICE_ORDER, CONTROLS_CONFIG } from '../config';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // --- Core State ---
  const [currentService, setCurrentService] = useState(SERVICES[SERVICE_ORDER[0]]);
  const [originalImage, setOriginalImage] = useState(null);
  const [originalCanvas, setOriginalCanvas] = useState(null);
  const [resultCanvas, setResultCanvas] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  // --- Tool Specific State ---
  const [samPoints, setSamPoints] = useState([]);
  const [samPointLabel, setSamPointLabel] = useState(1);
  const [editing, setEditing] = useState({
    activeTool: 'none',
    activeMode: 'extract',
    brushSize: 30,
    isDrawing: false,
  });
  const [segmentationResult, setSegmentationResult] = useState(null);
  const [serviceResults, setServiceResults] = useState({});
  
  // Initialize settings from CONTROLS_CONFIG
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

  const updateServiceSetting = useCallback((serviceId, settingId, value) => {
    setServiceSettings(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [settingId]: value
      }
    }));
  }, []);

  // --- Optimized Actions ---

  const selectService = useCallback((serviceId) => {
    // 1. Capture current state for persistence
    setServiceResults(prev => ({
      ...prev,
      [currentService.id]: {
        resultCanvas,
        segmentationResult,
        samPoints
      }
    }));

    // 2. Hydrate next service state
    const nextResults = serviceResults[serviceId] || {};
    setResultCanvas(nextResults.resultCanvas || null);
    setSegmentationResult(nextResults.segmentationResult || null);
    setSamPoints(nextResults.samPoints || []);

    setCurrentService(SERVICES[serviceId]);
  }, [currentService.id, resultCanvas, segmentationResult, samPoints, serviceResults]);

  const updateProgress = useCallback((percent, message) => {
    setProgress({ percent, message });
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    // Clear existing timeout to prevent premature vanishing
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const resetWorkspace = useCallback(() => {
    setOriginalImage(null);
    setOriginalCanvas(null);
    setResultCanvas(null);
    setIsProcessing(false);
    setProgress({ percent: 0, message: '' });
    setSamPoints([]);
    setServiceResults({});
    setSegmentationResult(null);
  }, []);

  // --- Memoized Value (CRITICAL FOR PERFORMANCE) ---
  const contextValue = useMemo(() => ({
    currentService,
    setCurrentService,
    selectService,
    originalImage,
    setOriginalImage,
    originalCanvas,
    setOriginalCanvas,
    resultCanvas,
    setResultCanvas,
    isProcessing,
    setIsProcessing,
    progress,
    updateProgress,
    toast,
    showToast,
    resetWorkspace,
    samPoints,
    setSamPoints,
    samPointLabel,
    setSamPointLabel,
    editing,
    setEditing,
    segmentationResult,
    setSegmentationResult,
    serviceSettings,
    updateServiceSetting
  }), [
    currentService, originalImage, originalCanvas, resultCanvas,
    isProcessing, progress, toast, samPoints, samPointLabel,
    editing, segmentationResult, selectService, updateProgress,
    showToast, resetWorkspace, serviceSettings, updateServiceSetting
  ]);

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
