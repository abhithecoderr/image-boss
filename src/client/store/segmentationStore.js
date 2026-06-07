import { create } from "zustand";

const initialEditingState = {
  activeTool: "none",
  activeMode: "extract",
  brushSize: 30,
  isDrawing: false,
  activeStepId: null,
};

export const useSegmentationStore = create((set) => ({
  samPoints: [],
  samPointLabel: 1,
  segmentationResult: null,
  editing: { ...initialEditingState },
  activeEditorTab: "composition",
  magicEraseMaskCanvas: null,

  setSamPoints: (updater) =>
    set((state) => ({
      samPoints: typeof updater === "function" ? updater(state.samPoints) : updater,
    })),

  setSamPointLabel: (label) => set({ samPointLabel: label }),
  setSegmentationResult: (result) => set({ segmentationResult: result }),

  setEditing: (updater) =>
    set((state) => ({
      editing: typeof updater === "function" ? updater(state.editing) : updater,
    })),

  setActiveEditorTab: (tab) => set({ activeEditorTab: tab }),
  setMagicEraseMaskCanvas: (canvas) => set({ magicEraseMaskCanvas: canvas }),

  resetSegmentationState: () =>
    set({
      samPoints: [],
      samPointLabel: 1,
      segmentationResult: null,
      editing: { ...initialEditingState },
      activeEditorTab: "composition",
      magicEraseMaskCanvas: null,
    }),
}));
