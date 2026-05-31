import { disposeBatchItem } from "../../core/BatchItem";

export const INITIAL_STATE = {
  items: [],
  activeItemId: null,
  workflowSteps: [],
  selectedIds: new Set(),
  batchMode: "single",
  isProcessing: false,
};

export function workspaceReducer(state, action) {
  switch (action.type) {
    case "SET_ITEMS": {
      const newItems = typeof action.payload === "function" ? action.payload(state.items) : action.payload;
      return {
        ...state,
        items: newItems,
      };
    }
    case "SET_ACTIVE_ITEM": {
      const newActiveId = typeof action.payload === "function" ? action.payload(state.activeItemId) : action.payload;
      return {
        ...state,
        activeItemId: newActiveId,
      };
    }
    case "SET_WORKFLOW_STEPS": {
      const newSteps = typeof action.payload === "function" ? action.payload(state.workflowSteps) : action.payload;
      return {
        ...state,
        workflowSteps: newSteps,
      };
    }
    case "SET_SELECTED_IDS": {
      const newSelected = typeof action.payload === "function" ? action.payload(state.selectedIds) : action.payload;
      return {
        ...state,
        selectedIds: newSelected instanceof Set ? newSelected : new Set(newSelected),
      };
    }
    case "SET_BATCH_MODE": {
      const newMode = typeof action.payload === "function" ? action.payload(state.batchMode) : action.payload;
      return {
        ...state,
        batchMode: newMode,
      };
    }
    case "SET_IS_PROCESSING": {
      const newProcessing = typeof action.payload === "function" ? action.payload(state.isProcessing) : action.payload;
      return {
        ...state,
        isProcessing: newProcessing,
      };
    }
    case "SET_ORIGINAL_CANVAS": {
      const canvas = action.payload;
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === state.activeItemId ? { ...item, sourceCanvas: canvas } : item
        ),
      };
    }
    case "SET_ORIGINAL_FILE": {
      const file = action.payload;
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === state.activeItemId ? { ...item, file } : item
        ),
      };
    }
    case "SET_RESULT_CANVAS": {
      const canvas = action.payload;
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === state.activeItemId ? { ...item, resultCanvas: canvas } : item
        ),
      };
    }
    case "RESET_WORKSPACE": {
      state.items.forEach((item) => disposeBatchItem(item));
      return {
        ...INITIAL_STATE,
        selectedIds: new Set(),
      };
    }
    default:
      return state;
  }
}
