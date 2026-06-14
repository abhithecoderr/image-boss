/*
 * Consolidates stores and exports React-friendly hook adapters with selectors.
 */
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from './workspaceStore';
import { useServiceStore } from './serviceStore';
import { useUIStore } from './uiStore';
import { useSegmentationStore } from './segmentationStore';
import { useAuthStore } from './authStore';
import { useSession } from '../lib/auth-client';
import { getDownloadMetadata as calculateMetadata } from '../core/canvas-utils';
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



// Export backward compatible Zustand bridge hooks with selector optimization.
// When called without a selector, useShallow memoizes the derived object so the
// consumer only re-renders when one of the selected primitives actually changes
// (not on every store tick, e.g. batch status flips on unrelated items).
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

  const activeItem = useMemo(
    () => storeState.items.find((i) => i.id === storeState.activeItemId) || null,
    [storeState.items, storeState.activeItemId],
  );

  return useMemo(
    () => ({
      ...storeState,
      activeItem,
      originalCanvas: activeItem?.sourceCanvas || null,
      originalFile: activeItem?.file || null,
      resultCanvas: activeItem?.resultCanvas || null,
    }),
    [storeState, activeItem],
  );
};

export const useService = (selector) => {
  if (selector) {
    return useServiceStore(selector);
  }

  const navigate = useNavigate();
  const storeState = useServiceStore(
    useShallow((s) => ({
      activeServiceId: s.activeServiceId,
      setActiveServiceId: s.setActiveServiceId,
      serviceSettings: s.serviceSettings,
      setServiceSettings: s.setServiceSettings,
      updateServiceSetting: s.updateServiceSetting,
    })),
  );

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
export { useAuthStore } from './authStore';
