/*
 * Controls global workspace overlays, notifications, and loading bars
 */
import { create } from "zustand";
import { PROGRESS_STAGE } from "../config/progress";

let toastTimeout = null;

const STAGE_TEMPLATES = {
  [PROGRESS_STAGE.DOWNLOADING]: (d, msg) => msg || `Downloading models${d.file ? ` [${d.file}]` : ""}...`,
  [PROGRESS_STAGE.INITIALIZING]: (d, msg) => msg || "Initializing engine...",
  [PROGRESS_STAGE.PROCESSING]: (d, msg) => msg || "Processing...",
  [PROGRESS_STAGE.SAVING]: (d, msg) => msg || "Saving result...",
  [PROGRESS_STAGE.IDLE]: () => "",
};

export const useUIStore = create((set, get) => ({
  toast: null,
  progress: { percent: 0, message: "", stage: PROGRESS_STAGE.IDLE },
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

  updateProgress: (payloadOrPercent, legacyMessage) => {
    let stage = PROGRESS_STAGE.PROCESSING;
    let percent = 0;
    let message = "";
    let details = {};

    if (typeof payloadOrPercent === "object" && payloadOrPercent !== null) {
      stage = payloadOrPercent.stage || PROGRESS_STAGE.PROCESSING;
      percent = payloadOrPercent.percent !== undefined ? payloadOrPercent.percent : 0;
      message = payloadOrPercent.message || "";
      details = payloadOrPercent.details || {};
    } else {
      percent = typeof payloadOrPercent === "number" ? payloadOrPercent : 0;
      message = legacyMessage || "";
    }

    const getTemplate = STAGE_TEMPLATES[stage] || ((d, msg) => msg || "Working...");
    let formattedMessage = getTemplate(details, message);

    // Apply batch/step prefixes centrally
    const batchPrefix = details.itemIndex && details.itemTotal
      ? `[Image ${details.itemIndex}/${details.itemTotal}] `
      : "";
    const stepPrefix = details.stepIndex && details.stepTotal
      ? `Step ${details.stepIndex}/${details.stepTotal}: `
      : "";

    formattedMessage = `${batchPrefix}${stepPrefix}${formattedMessage}`;

    set({ progress: { percent, message: formattedMessage, stage } });
  },

  clearProgress: () => {
    set({ progress: { percent: 0, message: "", stage: PROGRESS_STAGE.IDLE } });
  },
}));

