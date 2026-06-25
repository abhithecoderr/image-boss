/*
 * Consolidates stores and exports React-friendly hook adapters with selectors.
 */
import { useWorkspaceStore } from './workspaceStore';
import { useWorkflowStore } from './workflowStore';
import { useServiceStore } from './serviceStore';
import { useUIStore } from './uiStore';
import { useSegmentationStore } from './segmentationStore';
import { useAuthStore } from './authStore';
import { useSession } from '../auth/client';
import { getDownloadMetadata as calculateMetadata } from '../utils/canvas-utils';
import { useNavigate } from 'react-router-dom';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';
import { useEffect } from 'react';


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

export const useWorkflow = (selector) => {
  if (selector) {
    return useWorkflowStore(selector);
  }
  return useWorkflowStore();
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

  // Fetch permissions if authenticated and hasPaidAccess is not loaded yet
  useEffect(() => {
    if (user && !store.hasPaidAccessLoaded) {
      fetch('/api/predict/permissions')
        .then(res => {
          if (!res.ok) throw new Error("Permission fetch failed");
          return res.json();
        })
        .then(body => {
          store.setHasPaidAccess(!!body.hasPaidAccess);
        })
        .catch(err => {
          console.warn("Failed to fetch user permissions:", err);
        });
    }
  }, [user, store.hasPaidAccessLoaded, store.setHasPaidAccess]);

  return {
    ...store,
    user,
    loading: isPending,
    isAuthenticated: !!user,
    refetchSession: refetch,
  };
};



// Hook adapter for workspace store with optional selector subscription.
export const useWorkspace = (selector) => {
  if (selector) {
    return useWorkspaceStore(selector);
  }

  const storeState = useWorkspaceStore();
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
  const storeState = useServiceStore();

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
export { useWorkflowStore } from './workflowStore';
export { useServiceStore } from './serviceStore';
export { useUIStore } from './uiStore';
export { useSegmentationStore } from './segmentationStore';
export { useAuthStore } from './authStore';
