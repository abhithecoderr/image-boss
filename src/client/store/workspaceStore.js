import { create } from "zustand";
import { disposeBatchItem } from "../core/BatchItem";

export const useWorkspaceStore = create((set, get) => ({
  items: [],
  activeItemId: null,
  workflowSteps: [],
  selectedIds: new Set(),
  batchMode: "single",
  isProcessing: false,
  batchSettingsTarget: "all",

  setItems: (updater) =>
    set((state) => ({
      items: typeof updater === "function" ? updater(state.items) : updater,
    })),

  setActiveItemId: (id) => set({ activeItemId: id }),
  setWorkflowSteps: (updater) =>
    set((state) => ({
      workflowSteps: typeof updater === "function" ? updater(state.workflowSteps) : updater,
    })),
  setSelectedIds: (updater) =>
    set((state) => ({
      selectedIds: typeof updater === "function" ? updater(state.selectedIds) : updater,
    })),
  setBatchMode: (mode) => set({ batchMode: mode }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setBatchSettingsTarget: (target) => set({ batchSettingsTarget: target }),

  setOriginalCanvas: (canvas) => {
    const { activeItemId } = get();
    set((state) => ({
      items: state.items.map((item) =>
        item.id === activeItemId ? { ...item, sourceCanvas: canvas } : item,
      ),
    }));
  },

  setOriginalFile: (file) => {
    const { activeItemId } = get();
    set((state) => ({
      items: state.items.map((item) =>
        item.id === activeItemId ? { ...item, file } : item,
      ),
    }));
  },

  setResultCanvas: (canvas) => {
    const { activeItemId } = get();
    set((state) => ({
      items: state.items.map((item) =>
        item.id === activeItemId ? { ...item, resultCanvas: canvas } : item,
      ),
    }));
  },

  resetImages: () => {
    const { items } = get();
    items.forEach((item) => disposeBatchItem(item));
    set({
      items: [],
      activeItemId: null,
      workflowSteps: [],
      selectedIds: new Set(),
      batchMode: "single",
      isProcessing: false,
      batchSettingsTarget: "all",
    });
  },
}));
