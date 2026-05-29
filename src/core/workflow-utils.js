/**
 * workflow-utils.js
 * Pure utility functions for workflow step management.
 */

export function createStepId() {
  return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createStep(serviceId, options) {
  return { id: createStepId(), serviceId, options };
}

export function removeStep(steps, id) {
  return steps.filter((step) => step.id !== id);
}

export function updateStepOptions(steps, id, options) {
  return steps.map((step) =>
    step.id === id ? { ...step, options } : step
  );
}

export function reorderSteps(steps, startIndex, endIndex) {
  const result = Array.from(steps);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}
