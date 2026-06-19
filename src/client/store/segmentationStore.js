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

export const useSegmentationStore = create((set, get) => ({
  samPoints: [],
  samPointLabel: 1,
  segmentationResult: null,
  editing: { ...initialEditingState },
  magicEraseMaskCanvas: null,
  isGeneratingMask: false,

  setSamPoints: (samPoints) => set({ samPoints }),

  setSamPointLabel: (label) => set({ samPointLabel: label }),
  setSegmentationResult: (result) => {
    disposeSegmentationResult(get().segmentationResult);
    set({ segmentationResult: result });
  },

  setEditing: (update) =>
    set((state) => ({
      editing: {
        ...state.editing,
        ...update,
      },
    })),

  setMagicEraseMaskCanvas: (canvas) => set({ magicEraseMaskCanvas: canvas }),
  setIsGeneratingMask: (loading) => set({ isGeneratingMask: loading }),

  resetSegmentationState: (excludeMagicErase = false) => {
    disposeSegmentationResult(get().segmentationResult);
    set((state) => ({
      samPoints: [],
      samPointLabel: 1,
      segmentationResult: null,
      editing: { ...initialEditingState },
      magicEraseMaskCanvas: excludeMagicErase ? state.magicEraseMaskCanvas : null,
      isGeneratingMask: false,
    }));
  },
}));

function disposeSegmentationResult(result) {
  if (!result?.options) return;
  for (const opt of result.options) {
    if (opt.maskBitmap && typeof opt.maskBitmap.close === 'function') {
      try { opt.maskBitmap.close(); } catch (_) {}
    }
  }
}
