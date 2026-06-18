/*
 * Tracks batch items, active file selections, and workflow step histories.
 */
import { create } from "zustand";
import { disposeBatchItem } from "../engine/BatchItem";

/**
 * Release a result/step canvas that is about to be overwritten.
 *
 * Only closes objects with an explicit `.close()` (OffscreenCanvas, ImageBitmap) —
 * these pin GPU/copied memory until closed and aren't part of the undo history
 * stack (which only ever holds HTMLCanvasElement references). HTMLCanvasElement
 * is left to GC to avoid use-after-dispose against the Workspace undo stack.
 */
function disposeCanvasIfClosable(canvas) {
  if (!canvas || canvas === null) return;
  // HTMLCanvasElement has no close() — skip it (undo stack may reference it).
  if (canvas instanceof HTMLCanvasElement) return;
  if (typeof canvas.close === 'function') {
    try { canvas.close(); } catch (_) {}
  }
}

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

  // stepId: optional — pass when updating a specific workflow step result (e.g. from mask editor)
  setResultCanvas: (canvas, stepId = null) => {
    const { activeItemId } = get();
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== activeItemId) return item;

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
