import React, { useCallback, useMemo } from 'react';
import { useWorkspaceStore } from './workspaceStore';
import { useServiceStore } from './serviceStore';
import { useUIStore } from './uiStore';
import { useSegmentationStore } from './segmentationStore';
import { useAuthStore } from './authStore';
import { useServiceEngine } from '../hooks/useServiceEngine';
import { useSession } from '../lib/auth-client';
import { useUnifiedProcessor } from '../hooks/useUnifiedProcessor';
import { getDownloadMetadata as calculateMetadata } from '../core/canvas-utils';

/**
 * AppProvider
 * Render pass-through now that all states are managed via Zustand stores.
 * No Context Providers are nested here.
 */
export const AppProvider = ({ children }) => {
  return <>{children}</>;
};

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
  const { data, isPending } = useSession();

  const user = useMemo(() => {
    if (!data?.user) return null;
    return {
      ...data.user,
      initials: data.user.name
        ? data.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : "US",
    };
  }, [data?.user]);

  return {
    ...store,
    user,
    loading: isPending,
    isAuthenticated: !!user,
  };
};

export const useController = () => {
  return useUnifiedProcessor();
};

// Export backward compatible Zustand bridge hooks with memoization to prevent infinite loops
export const useWorkspace = (selector) => {
  const storeState = useWorkspaceStore();
  const selectorResult = useWorkspaceStore(selector || ((s) => s));

  const memoizedResult = useMemo(() => {
    const activeItem = storeState.items.find((i) => i.id === storeState.activeItemId) || null;
    return {
      ...storeState,
      activeItem,
      originalCanvas: activeItem?.sourceCanvas || null,
      originalFile: activeItem?.file || null,
      resultCanvas: activeItem?.resultCanvas || null,
    };
  }, [storeState]);

  if (selector) {
    return selectorResult;
  }

  return memoizedResult;
};

export const useService = (selector) => {
  const { currentService, serviceId, selectService } = useServiceEngine();
  
  const activeItemId = useWorkspaceStore((state) => state.activeItemId);
  const items = useWorkspaceStore((state) => state.items);
  
  const activeItem = useMemo(() => items.find((i) => i.id === activeItemId) || null, [items, activeItemId]);
  const originalFile = activeItem?.file || null;
  const resultCanvas = activeItem?.resultCanvas || null;

  const storeState = useServiceStore();
  const selectorResult = useServiceStore(selector || ((s) => s));

  const getDownloadMetadata = useCallback(
    (item = null, overrideServiceId = null, resultCanvasArg = null) => {
      const canvas = resultCanvasArg || item?.resultCanvas || resultCanvas;
      const sourceFile = item?.file || originalFile;
      const activeServiceId = overrideServiceId || currentService.id;

      return calculateMetadata(
        canvas,
        sourceFile,
        activeServiceId,
        useServiceStore.getState().serviceSettings,
      );
    },
    [originalFile, currentService.id, resultCanvas],
  );

  const memoizedResult = useMemo(() => {
    return {
      ...storeState,
      currentService,
      serviceId,
      selectService,
      getDownloadMetadata,
    };
  }, [storeState, currentService, serviceId, selectService, getDownloadMetadata]);

  if (selector) {
    return selectorResult;
  }

  return memoizedResult;
};

// Re-export raw stores for direct access
export { useWorkspaceStore } from './workspaceStore';
export { useServiceStore } from './serviceStore';
export { useUIStore } from './uiStore';
export { useSegmentationStore } from './segmentationStore';
export { useAuthStore } from './authStore';
