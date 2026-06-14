/*
 * Consolidates stores and exports React-friendly hook adapters with selectors.
 */
import { useMemo } from 'react';
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



// Export backward compatible Zustand bridge hooks with selector optimization
export const useWorkspace = (selector) => {
  if (selector) {
    return useWorkspaceStore(selector);
  }

  const storeState = useWorkspaceStore();
  const activeItem = useMemo(
    () => storeState.items.find((i) => i.id === storeState.activeItemId) || null,
    [storeState.items, storeState.activeItemId],
  );
  
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

  const storeState = useServiceStore();
  const activeServiceId = storeState.activeServiceId || SERVICE_ORDER[0];
  const currentService = SERVICES[activeServiceId] || SERVICES[SERVICE_ORDER[0]];

  const navigate = useNavigate();
  const selectService = (targetServiceId) => {
    navigate(`/services/${targetServiceId}`);
  };

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
