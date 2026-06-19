/*
 * Controls global workspace overlays, notifications, and loading bars
 */
import { create } from "zustand";

let toastTimeout = null;

export const useUIStore = create((set, get) => ({
  toast: null,
  progress: { percent: 0, message: "" },
  isPageLoading: false,
  activeEditorTab: "composition",
  batchMode: "single",
  batchSettingsTarget: "all",

  setPageLoading: (isPageLoading) => set({ isPageLoading }),
  setActiveEditorTab: (activeEditorTab) => set({ activeEditorTab }),
  setBatchMode: (batchMode) => set({ batchMode }),
  setBatchSettingsTarget: (batchSettingsTarget) => set({ batchSettingsTarget }),
  resetUIState: () => set({
    activeEditorTab: "composition",
    batchMode: "single",
    batchSettingsTarget: "all",
  }),

  showToast: (message, type = "info") => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    set({ toast: { message, type } });

    toastTimeout = setTimeout(() => {
      set({ toast: null });
      toastTimeout = null;
    }, 3000);
  },

  updateProgress: (percent, message) => {
    set({ progress: { percent, message } });
  },

  clearProgress: () => {
    set({ progress: { percent: 0, message: "" } });
  },
}));

