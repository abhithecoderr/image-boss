/*
 * Consolidates stores and exports React-friendly hook adapters with selectors.
 */
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from './workspaceStore';
import { useServiceStore } from './serviceStore';
import { useUIStore } from './uiStore';
import { useSegmentationStore } from './segmentationStore';
import { useAuthStore } from '../auth/store';
import { useSession } from '../auth/client';
import { getDownloadMetadata as calculateMetadata } from '../utils/canvas-utils';
import { useNavigate } from 'react-router-dom';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';


// --- Standardized Store Hook Exports ---

export const useUI = (selector) => {
  if (selector) {
    return useUIStore(selector);
  }
  return useUIStore();
};

export const useSegmentation = (selector) => {
  if (selector) {
    return useSegmentationStore(selector);
  }
  return useSegmentationStore();
};

export const useAuth = () => {
  const store = useAuthStore();
  const { data, isPending, refetch } = useSession();

  let user = null;
  if (data?.user) {
    user = {
      ...data.user,
      initials: data.user.name
        ? data.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : "US",
    };
  }

  return {
    ...store,
    user,
    loading: isPending,
    isAuthenticated: !!user,
    refetchSession: refetch,
  };
};



// useShallow on useWorkspace: the workspace store fires on every canvas op,
// batch tick, and item status flip — shallow comparison prevents consumers
// from re-rendering on unrelated store updates. React Compiler handles the
// return object memoisation, so no useMemo needed here.
export const useWorkspace = (selector) => {
  if (selector) {
    return useWorkspaceStore(selector);
  }

  const storeState = useWorkspaceStore(
    useShallow((s) => ({
      items: s.items,
      activeItemId: s.activeItemId,
      setItems: s.setItems,
      setOriginalCanvas: s.setOriginalCanvas,
      setOriginalFile: s.setOriginalFile,
      setResultCanvas: s.setResultCanvas,
      resetImages: s.resetImages,
      workflowSteps: s.workflowSteps,
      setWorkflowSteps: s.setWorkflowSteps,
      selectedIds: s.selectedIds,
      setSelectedIds: s.setSelectedIds,
      batchMode: s.batchMode,
      setBatchMode: s.setBatchMode,
      isProcessing: s.isProcessing,
      setIsProcessing: s.setIsProcessing,
      batchSettingsTarget: s.batchSettingsTarget,
      setBatchSettingsTarget: s.setBatchSettingsTarget,
      setActiveItemId: s.setActiveItemId,
    })),
  );

  const activeItem = storeState.items.find((i) => i.id === storeState.activeItemId) || null;

  return {
    ...storeState,
    activeItem,
    originalCanvas: activeItem?.sourceCanvas || null,
    originalFile: activeItem?.file || null,
    resultCanvas: activeItem?.resultCanvas || null,
  };
};

export const useService = (selector) => {
  if (selector) {
    return useServiceStore(selector);
  }

  const navigate = useNavigate();
  const storeState = useServiceStore((s) => ({
    activeServiceId: s.activeServiceId,
    setActiveServiceId: s.setActiveServiceId,
    serviceSettings: s.serviceSettings,
    setServiceSettings: s.setServiceSettings,
    updateServiceSetting: s.updateServiceSetting,
  }));

  const activeServiceId = storeState.activeServiceId || SERVICE_ORDER[0];
  const currentService = SERVICES[activeServiceId] || SERVICES[SERVICE_ORDER[0]];

  // Callers (Workspace.jsx) always pass resultCanvasArg and item explicitly.
  const getDownloadMetadata = (item = null, overrideServiceId = null, resultCanvasArg = null) => {
    const canvas = resultCanvasArg || item?.resultCanvas;
    const sourceFile = item?.file;
    const activeServiceIdForMetadata = overrideServiceId || activeServiceId;

    return calculateMetadata(
      canvas,
      sourceFile,
      activeServiceIdForMetadata,
      storeState.serviceSettings,
    );
  };

  // selectService is the only non-store field — stable via useCallback-free
  // closure; identity changes per render but callers use it in onClick only.
  const selectService = (targetServiceId) => {
    navigate(`/services/${targetServiceId}`);
  };

  return {
    ...storeState,
    currentService,
    serviceId: activeServiceId,
    selectService,
    getDownloadMetadata,
  };
};

// Re-export raw stores for direct access
export { useWorkspaceStore } from './workspaceStore';
export { useServiceStore } from './serviceStore';
export { useUIStore } from './uiStore';
export { useSegmentationStore } from './segmentationStore';
export { useAuthStore } from '../auth/store';
