/*
 * Manages workflow steps pipeline state and mutation actions.
 */
import { create } from "zustand";
import {
  createStep,
  removeStep as utilRemoveStep,
  updateStepOptions as utilUpdateStepOptions,
  reorderSteps as utilReorderSteps,
} from "../utils/canvas-utils";

export const useWorkflowStore = create((set) => ({
  workflowSteps: [],

  setWorkflowSteps: (workflowSteps) => set({ workflowSteps }),

  addWorkflowStep: (serviceId, options) => set((state) => ({
    workflowSteps: [...state.workflowSteps, createStep(serviceId, options)]
  })),

  removeWorkflowStep: (id) => set((state) => ({
    workflowSteps: utilRemoveStep(state.workflowSteps, id)
  })),

  updateWorkflowStepOptions: (id, options) => set((state) => ({
    workflowSteps: utilUpdateStepOptions(state.workflowSteps, id, options)
  })),

  reorderWorkflowSteps: (startIndex, endIndex) => set((state) => ({
    workflowSteps: utilReorderSteps(state.workflowSteps, startIndex, endIndex)
  })),

  resetWorkflow: () => set({ workflowSteps: [] }),
}));
