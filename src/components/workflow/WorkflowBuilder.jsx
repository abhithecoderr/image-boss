import React, { useMemo, useCallback } from "react";
import { useWorkspace, useUI, useService } from "../../context/AppContext";
import { SERVICE_ORDER } from "../../config/app";
import { SERVICES } from "../../config/services";
import { CONTROLS_CONFIG } from "../../config/controls";
import { downloadCanvas } from "../../core/canvas-utils";
import ControlRenderer from "../controls/ControlRenderer";
import Select from "../ui/Select";
import Button from "../ui/Button";

const WorkflowBuilder = ({ workflow, onProcess }) => {
  const { originalCanvas, items, activeItemId, setResultCanvas, workflowSteps } = useWorkspace();
  const { showToast } = useUI();
  const { getDownloadMetadata } = useService();
  const {
    addStep,
    removeStep,
    updateStepOptions,
    reorderSteps,
  } = workflow;

  const previewStep = useCallback((stepId) => {
    const activeItem = items.find(i => i.id === activeItemId);
    if (!activeItem) return showToast('No active item selected', 'info');

    const stepResult = activeItem.stepResults?.[stepId]?.resultCanvas;
    if (stepResult) {
      setResultCanvas(stepResult);
      showToast('Previewing step result', 'info');
    } else {
      showToast('Step result not available yet. Please run the workflow.', 'warning');
    }
  }, [items, activeItemId, setResultCanvas, showToast]);

  const downloadStepFn = useCallback((stepId) => {
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
  }, [items, activeItemId, workflowSteps, getDownloadMetadata, showToast]);

  // Filter out meta-services and interactive tools
  const availableServices = useMemo(() => {
    return SERVICE_ORDER.filter(
      (id) =>
        id !== "workflows" &&
        id !== "magic-erase" &&
        id !== "object-segmentation" &&
        SERVICES[id] &&
        !SERVICES[id].disabled,
    );
  }, []);

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

                <div className="step-controls">
                  <div className="service-control-grid">
                    {(CONTROLS_CONFIG[step.serviceId] || []).map((config) => (
                      (!config.visibleIf || config.visibleIf(step.options)) && (
                        <ControlRenderer
                          key={config.id}
                          control={config}
                          value={step.options[config.id] ?? config.defaultValue}
                          onChange={(id, val, parse) => {
                            const parsedVal = parse ? parse(val) : val;
                            updateStepOptions(step.id, {
                              ...step.options,
                              [id]: parsedVal,
                            });
                          }}
                        />
                      )
                    ))}
                  </div>
                </div>
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
              const allDone =
                workflow.items.length > 0 &&
                workflow.items.every((i) => i.status === "done");
              onProcess({}, { forceReset: allDone });
            }}
            disabled={workflowSteps.length === 0 || workflow.items.length === 0}
          >
            {workflow.items.length > 0 &&
            workflow.items.every((i) => i.status === "done")
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

export default React.memo(WorkflowBuilder);
