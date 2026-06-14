/*
 * Stores points, labels, masks, and active tools for interactive SAM object segmentation.
 */
import { create } from "zustand";

const initialEditingState = {
  activeTool: "none",
  activeMode: "extract",
  brushSize: 30,
  isDrawing: false,
  activeStepId: null,
};

/**
 * Release the ImageBitmaps held by a segmentation result's candidate options.
 * Each MaskCandidate stores a full-res `maskBitmap` that pins graphics memory
 * until explicitly closed — simply dropping the JS reference is not enough.
 */
function disposeSegmentationResult(result) {
  if (!result?.options) return;
  for (const opt of result.options) {
    if (opt.maskBitmap && typeof opt.maskBitmap.close === 'function') {
      try { opt.maskBitmap.close(); } catch (_) {}
    }
  }
}

export const useSegmentationStore = create((set, get) => ({
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
  setSegmentationResult: (result) => {
    disposeSegmentationResult(get().segmentationResult);
    set({ segmentationResult: result });
  },

  setEditing: (updater) =>
    set((state) => ({
      editing: typeof updater === "function" ? updater(state.editing) : updater,
    })),

  setActiveEditorTab: (tab) => set({ activeEditorTab: tab }),
  setMagicEraseMaskCanvas: (canvas) => set({ magicEraseMaskCanvas: canvas }),

  resetSegmentationState: (excludeMagicErase = false) => {
    disposeSegmentationResult(get().segmentationResult);
    set((state) => ({
      samPoints: [],
      samPointLabel: 1,
      segmentationResult: null,
      editing: { ...initialEditingState },
      activeEditorTab: "composition",
      magicEraseMaskCanvas: excludeMagicErase ? state.magicEraseMaskCanvas : null,
    }));
  },
}));
