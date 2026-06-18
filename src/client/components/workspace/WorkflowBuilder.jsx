import React from "react";
import { useWorkspace, useUI, useService, useSegmentation } from "../../store";
import Slider from "../ui/Slider";
import { SERVICE_ORDER } from "../../config/app";
import { SERVICES } from "../../config/services";
import { CONTROLS_CONFIG } from "../../config/controls";
import { BACKGROUND_REMOVAL_MODELS } from "../../config/models";
import { downloadCanvas } from "../../utils/canvas-utils";
import ControlRenderer from "../controls/ControlRenderer";
import Select from "../ui/Select";
import Button from "../ui/Button";
import BatchSettingsSelector from "../controls/BatchSettingsSelector";

const WorkflowBuilder = ({ workflow, onProcess }) => {
  const { originalCanvas, items, activeItemId, setResultCanvas, workflowSteps } = useWorkspace();
  const { showToast } = useUI();
  const { getDownloadMetadata } = useService();
  const editing = useSegmentation((state) => state.editing);
  const setEditing = useSegmentation((state) => state.setEditing);
  const {
    addStep,
    removeStep,
    updateStepOptions,
    reorderSteps,
  } = workflow;

  const previewStep = (stepId) => {
    const activeItem = items.find(i => i.id === activeItemId);
    if (!activeItem) return showToast('No active item selected', 'info');

    const stepResult = activeItem.stepResults?.[stepId]?.resultCanvas;
    if (stepResult) {
      setResultCanvas(stepResult);
      showToast('Previewing step result', 'info');
    } else {
      showToast('Step result not available yet. Please run the workflow.', 'warning');
    }
  };

  const downloadStepFn = (stepId) => {
    const activeItem = items.find(i => i.id === activeItemId);
    if (!activeItem) return showToast('No active item selected', 'info');

    const stepResult = activeItem.stepResults?.[stepId]?.resultCanvas;
    if (stepResult) {
      const step = workflowSteps.find(s => s.id === stepId);
      const { filename, mimeType } = getDownloadMetadata(activeItem, step?.serviceId, stepResult);
      downloadCanvas(stepResult, filename, mimeType);
    } else {
      showToast('Step result not available yet. Please run the workflow.', 'warning');
    }
  };

  // Filter out meta-services and interactive tools
  const availableServices = SERVICE_ORDER.filter(
    (id) =>
      id !== "workflows" &&
      id !== "magic-erase" &&
      id !== "object-segmentation" &&
      SERVICES[id] &&
      !SERVICES[id].disabled,
  );

  const handleAddStep = (serviceId) => {
    if (!serviceId) return;

    // Get default values
    const config = CONTROLS_CONFIG[serviceId] || [];
    const defaults = {};
    config.forEach((c) => {
      defaults[c.id] = c.defaultValue;
    });

    addStep(serviceId, defaults);
  };

  return (
    <div className="controls workflow-builder-container">
      <BatchSettingsSelector />
      <div className="workflow-header-panel">
        <h3 className="workflow-header-title">Workflow Pipeline</h3>
        <div className="workflow-add-step">
          <span className="workflow-add-step-label">Add Step:</span>
          <Select
            options={[
              { value: "", label: "Select Service...", disabled: true },
              ...availableServices.map((id) => ({
                value: id,
                label: SERVICES[id].name,
              })),
            ]}
            value=""
            onChange={handleAddStep}
          />
        </div>
      </div>

      <div className="workflow-steps-list">
        {workflowSteps.length === 0 ? (
          <p className="workflow-empty-hint">
            No steps added. Build your pipeline above.
          </p>
        ) : (
          workflowSteps.map((step, index) => {
            const service = SERVICES[step.serviceId];

            return (
              <div key={step.id} className="workflow-step-card">
                <div className="workflow-step-header">
                  <strong className="workflow-step-title">
                    <span className="workflow-step-number">{index + 1}</span>
                    {service.name}
                  </strong>
                  <div className="workflow-step-actions">
                    <Button
                      variant="secondary"
                      size="tiny"
                      title="Preview Step Result"
                      onClick={(e) => {
                        e.preventDefault();
                        previewStep(step.id);
                      }}
                      icon={
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      }
                    />
                    <Button
                      variant="secondary"
                      size="tiny"
                      title="Download Step Result"
                      onClick={(e) => {
                        e.preventDefault();
                        downloadStepFn(step.id);
                      }}
                      icon={
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      }
                    />
                    <Button
                      variant="secondary"
                      size="tiny"
                      disabled={index === 0}
                      onClick={() => reorderSteps(index, index - 1)}
                      icon={
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
                      }
                    />
                    <Button
                      variant="secondary"
                      size="tiny"
                      disabled={index === workflowSteps.length - 1}
                      onClick={() => reorderSteps(index, index + 1)}
                      icon={
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <polyline points="19 12 12 19 5 12" />
                        </svg>
                      }
                    />
                    <Button
                      variant="secondary"
                      size="tiny"
                      className="workflow-step-action-delete"
                      onClick={() => removeStep(step.id)}
                      icon={
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      }
                    />
                  </div>
                </div>

                <div className="service-control-grid">
                  {(CONTROLS_CONFIG[step.serviceId] || []).map((config) => {
                    const globalVal = step.options[config.id] ?? config.defaultValue;
                    const activeVal =
                      workflow.batchSettingsTarget !== "all"
                        ? (workflow.items.find((i) => i.id === workflow.batchSettingsTarget)?.settingsOverrides?.[step.id]?.[config.id] ?? globalVal)
                        : globalVal;

                    // Resolve options if it is a function
                    let resolvedControl = config;
                    if (typeof config.options === "function") {
                      const currentSettings = (workflow.batchSettingsTarget !== "all"
                        ? {
                            ...step.options,
                            ...(workflow.items.find((i) => i.id === workflow.batchSettingsTarget)?.settingsOverrides?.[step.id] || {})
                          }
                        : step.options) || {};
                      resolvedControl = {
                        ...config,
                        options: config.options(currentSettings),
                      };
                    }

                    return (
                      (!config.visibleIf || config.visibleIf(step.options)) && (
                        <ControlRenderer
                          key={config.id}
                          control={resolvedControl}
                          value={activeVal}
                          onChange={(id, val, parse) => {
                            const parsedVal = parse ? parse(val) : val;
                            if (workflow.batchSettingsTarget !== "all") {
                              workflow.updateItemOverride(workflow.batchSettingsTarget, step.id, id, parsedVal);
                              if (step.serviceId === "background-removal" && id === "model") {
                                const modelCfg = BACKGROUND_REMOVAL_MODELS[parsedVal];
                                if (modelCfg && modelCfg.method !== "hybrid") {
                                  workflow.updateItemOverride(workflow.batchSettingsTarget, step.id, "method", modelCfg.method);
                                }
                              }
                            } else {
                              const nextOptions = {
                                ...step.options,
                                [id]: parsedVal,
                              };
                              if (step.serviceId === "background-removal" && id === "model") {
                                const modelCfg = BACKGROUND_REMOVAL_MODELS[parsedVal];
                                if (modelCfg && modelCfg.method !== "hybrid") {
                                  nextOptions.method = modelCfg.method;
                                }
                              }
                              updateStepOptions(step.id, nextOptions);
                            }
                          }}
                        />
                      )
                    );
                  })}
                </div>

                {step.serviceId === "background-removal" && (
                  <div className="control-manual-touchup" style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
                    <label className="control-label" style={{ marginBottom: "8px", display: "block" }}>
                      Manual Mask Touch-up
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div className="tab-group control-tabs">
                        <Button
                          variant={editing.activeTool === "none" || editing.activeStepId !== step.id ? "primary" : "secondary"}
                          className={editing.activeTool === "none" || editing.activeStepId !== step.id ? "active" : ""}
                          onClick={() =>
                            setEditing((prev) => ({ ...prev, activeTool: "none", activeStepId: null }))
                          }
                        >
                          Move
                        </Button>
                        <Button
                          variant={editing.activeTool === "erase" && editing.activeStepId === step.id ? "primary" : "secondary"}
                          className={editing.activeTool === "erase" && editing.activeStepId === step.id ? "active" : ""}
                          onClick={() => {
                            previewStep(step.id);
                            setEditing((prev) => ({ ...prev, activeTool: "erase", activeStepId: step.id }));
                          }}
                        >
                          Erase
                        </Button>
                        <Button
                          variant={editing.activeTool === "restore" && editing.activeStepId === step.id ? "primary" : "secondary"}
                          className={editing.activeTool === "restore" && editing.activeStepId === step.id ? "active" : ""}
                          onClick={() => {
                            previewStep(step.id);
                            setEditing((prev) => ({ ...prev, activeTool: "restore", activeStepId: step.id }));
                          }}
                        >
                          Restore
                        </Button>
                      </div>

                      {editing.activeTool !== "none" && editing.activeStepId === step.id && (
                        <Slider
                          label="Brush Size"
                          min={5}
                          max={150}
                          step={5}
                          value={editing.brushSize}
                          unit="px"
                          onChange={(val) =>
                            setEditing((prev) => ({
                              ...prev,
                              brushSize: val,
                            }))
                          }
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="actions-row">
        <div style={{ display: "flex", gap: "10px" }}>
          {/* Primary Action Button */}
          <Button
            variant="primary"
            size="large"
            onClick={() => {
              if (workflow.batchSettingsTarget !== "all") {
                workflow.executeSingleItemInWorkflow();
              } else {
                const allDone =
                  workflow.items.length > 0 &&
                  workflow.items.every((i) => i.status === "done");
                onProcess({}, { forceReset: allDone });
              }
            }}
            disabled={workflowSteps.length === 0 || workflow.items.length === 0}
          >
            {workflow.batchSettingsTarget !== "all"
              ? `Process Image ${workflow.items.findIndex(i => i.id === workflow.batchSettingsTarget) + 1}`
              : (workflow.items.length > 0 && workflow.items.every((i) => i.status === "done"))
                ? "Rerun Workflow Pipeline"
                : workflow.items.some((i) => i.status === "done")
                  ? "Run Pending"
                  : "Run Workflow Pipeline"}
          </Button>

          {/* Secondary Rerun All Button (only visible if some but not all items are done) */}
          {workflow.items.some((i) => i.status === "done") &&
            !workflow.items.every((i) => i.status === "done") && (
              <Button
                variant="secondary"
                size="large"
                onClick={() => onProcess({}, { forceReset: true })}
                disabled={workflowSteps.length === 0}
              >
                Rerun All
              </Button>
            )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
