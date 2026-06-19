/*
 * Tracks batch items, active file selections, and workflow step histories.
 */
import { create } from "zustand";
import { disposeBatchItem } from "../engine/BatchItem";


export const useWorkspaceStore = create((set, get) => ({
  items: [],
  activeItemId: null,
  selectedIds: new Set(),
  isProcessing: false,
  runToken: 0, // Execution/cancellation tracking token
  lastRunSteps: null, // Serialization cache to detect workflow configuration changes

  // Simplified basic setters (direct value only)
  setItems: (items) => set({ items }),
  setActiveItemId: (id) => set({ activeItemId: id }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  incrementRunToken: () => set((state) => ({ runToken: state.runToken + 1 })), // Cancels ongoing async tasks
  setLastRunSteps: (steps) => set({ lastRunSteps: steps }), // Cache step configurations

  // Semantic mutating actions for items
  addItems: (newItems) => set((state) => ({ items: [...state.items, ...newItems] })),
  removeItem: (id) => set((state) => {
    const itemToDispose = state.items.find((item) => item.id === id);
    if (itemToDispose) disposeBatchItem(itemToDispose);
    const nextItems = state.items.filter((item) => item.id !== id);
    
    const updates = { items: nextItems };
    if (state.activeItemId === id) {
      updates.activeItemId = null;
    }
    return updates;
  }),
  updateActiveItem: (fields) => set((state) => ({
    items: state.items.map((item) =>
      item.id === state.activeItemId ? { ...item, ...fields } : item
    )
  })),
  updateItemOverride: (itemId, serviceOrStepId, key, value) => set((state) => ({
    items: state.items.map((item) => {
      if (item.id !== itemId) return item;
      const currentOverrides = item.settingsOverrides || {};
      const stepOverrides = currentOverrides[serviceOrStepId] || {};
      return {
        ...item,
        settingsOverrides: {
          ...currentOverrides,
          [serviceOrStepId]: {
            ...stepOverrides,
            [key]: value,
          },
        },
      };
    })
  })),
  resetItemsStatus: () => set((state) => ({ items: resetItemsList(state.items) })),
  syncServiceChange: (oldServiceId, newServiceId) => set((state) => ({
    items: state.items.map((item) => {
      const serviceResults = item.serviceResults || {};
      const updatedServiceResults = {
        ...serviceResults,
        [oldServiceId]: {
          resultCanvas: item.resultCanvas,
          status: item.status,
          error: item.error,
        },
      };

      const restored = updatedServiceResults[newServiceId] || {
        resultCanvas: null,
        status: "pending",
        error: null,
      };

      return {
        ...item,
        serviceResults: updatedServiceResults,
        resultCanvas: restored.resultCanvas,
        status: restored.status,
        error: restored.error,
        progress: 0,
      };
    })
  })),



  // Semantic mutating actions for selections
  toggleItemSelection: (id) => set((state) => {
    const next = new Set(state.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { selectedIds: next };
  }),
  selectAllItems: () => set((state) => ({
    selectedIds: new Set(state.items.map((item) => item.id))
  })),
  deselectAllItems: () => set({ selectedIds: new Set() }),

  setOriginalCanvas: (canvas) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === state.activeItemId ? { ...item, sourceCanvas: canvas } : item,
      ),
    })),

  setOriginalFile: (file) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === state.activeItemId ? { ...item, file } : item,
      ),
    })),

  // stepId: optional — pass when updating a specific workflow step result (e.g. from mask editor)
  setResultCanvas: (canvas, stepId = null) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== state.activeItemId) return item;

        if (stepId) {
          const stepResults = item.stepResults || {};
          // Release the step result we're about to overwrite (closable types only).
          if (stepResults[stepId]?.resultCanvas) {
            disposeCanvasIfClosable(stepResults[stepId].resultCanvas);
          }
          return {
            ...item,
            stepResults: {
              ...stepResults,
              [stepId]: {
                ...(stepResults[stepId] || {}),
                resultCanvas: canvas,
                status: "done",
              },
            },
            resultCanvas: canvas,
          };
        }

        // Release the top-level result canvas we're about to overwrite (closable types only).
        disposeCanvasIfClosable(item.resultCanvas);
        return { ...item, resultCanvas: canvas };
      }),
    })),

  resetImages: () => {
    const { items } = get();
    items.forEach((item) => disposeBatchItem(item));
    set({
      items: [],
      activeItemId: null,
      selectedIds: new Set(),
      isProcessing: false,
    });
  },
}));


function disposeCanvasIfClosable(canvas) {
  if (!canvas || canvas === null) return;
  // HTMLCanvasElement has no close() — skip it (undo stack may reference it).
  if (canvas instanceof HTMLCanvasElement) return;
  if (typeof canvas.close === 'function') {
    try { canvas.close(); } catch (_) {}
  }
}

function resetItemsList(itemsList) {
  return itemsList.map((item) => {
    // Clear background removal and blur caches to prevent blank images or stale cache bugs on rerun
    if (item.sourceCanvas) {
      const bgCache = item.sourceCanvas._bgRemovalCache;
      if (bgCache && bgCache.maskBitmap) {
        try { bgCache.maskBitmap.close(); } catch (_) {}
      }
      delete item.sourceCanvas._bgRemovalCache;

      const blurCache = item.sourceCanvas._blurCache;
      if (blurCache && blurCache.lastSourceBitmap) {
        try { blurCache.lastSourceBitmap.close(); } catch (_) {}
      }
      delete item.sourceCanvas._blurCache;
    }

    // Dispose any intermediate canvas results in the step results list
    if (item.stepResults) {
      Object.values(item.stepResults).forEach((res) => {
        if (res.resultCanvas?.close) {
          try { res.resultCanvas.close(); } catch (_) {}
        }
      });
    }

    if (item.serviceResults) {
      Object.values(item.serviceResults).forEach((res) => {
        if (res.resultCanvas?.close) {
          try { res.resultCanvas.close(); } catch (_) {}
        }
      });
    }

    return {
      ...item,
      status: "pending",
      error: null,
      progress: 0,
      resultCanvas: null,
      stepResults: {},
      serviceResults: {},
    };
  });
}
