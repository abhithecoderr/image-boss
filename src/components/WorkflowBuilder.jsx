import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';
import { CONTROLS_CONFIG } from '../config/controls';
import ServiceControlGrid from './shared/ServiceControlGrid';

const WorkflowBuilder = ({ workflow, onProcess }) => {
  const { originalCanvas } = useApp();
  const { 
    workflowSteps, 
    addStep, 
    removeStep, 
    updateStepOptions, 
    reorderSteps, 
    previewStep, 
    downloadStep 
  } = workflow;
  
  const [activeStepCategories, setActiveStepCategories] = React.useState({});

  // Filter out meta-services and interactive tools
  const availableServices = useMemo(() => {
    return SERVICE_ORDER.filter(id =>
      id !== 'workflows' &&
      id !== 'magic-erase' &&
      id !== 'object-segmentation' &&
      SERVICES[id] &&
      !SERVICES[id].disabled
    );
  }, []);

  const handleAddStep = (e) => {
    const serviceId = e.target.value;
    if (!serviceId) return;

    // Get default values
    const config = CONTROLS_CONFIG[serviceId] || [];
    const defaults = {};
    config.forEach(c => { defaults[c.id] = c.defaultValue; });

    addStep(serviceId, defaults);
    e.target.value = ""; // reset dropdown
  };

  return (
    <div className="controls workflow-builder-container">
      <div className="workflow-header-panel">
        <h3 className="workflow-header-title">Workflow Pipeline</h3>
        <div className="workflow-add-step">
          <span className="workflow-add-step-label">Add Step:</span>
          <select
            className="control-select workflow-add-step-select"
            onChange={handleAddStep}
            value=""
          >
              <option value="" disabled>Select Service...</option>
              {availableServices.map(id => (
                  <option key={id} value={id}>{SERVICES[id].name}</option>
              ))}
          </select>
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
                                 {service.icon} {service.name}
                             </strong>
                             <div className="workflow-step-actions">
                                 <button
                                     className="btn btn-secondary btn-tiny"
                                     title="Preview Step Result"
                                     onClick={(e) => { e.preventDefault(); previewStep(step.id); }}
                                 >👁️</button>
                                 <button
                                     className="btn btn-secondary btn-tiny"
                                     title="Download Step Result"
                                     onClick={(e) => { e.preventDefault(); downloadStep(step.id); }}
                                 >📥</button>
                                 <button
                                     className="btn btn-secondary btn-tiny"
                                     disabled={index === 0}
                                     onClick={() => reorderSteps(index, index - 1)}
                                 >⬆️</button>
                                 <button
                                     className="btn btn-secondary btn-tiny"
                                     disabled={index === workflowSteps.length - 1}
                                     onClick={() => reorderSteps(index, index + 1)}
                                 >⬇️</button>
                                 <button
                                     className="btn btn-secondary btn-tiny workflow-step-action-delete"
                                     onClick={() => removeStep(step.id)}
                                 >✖</button>
                             </div>
                         </div>

                         <div className="step-controls">
                            <ServiceControlGrid 
                              serviceId={step.serviceId}
                              options={step.options}
                              onChange={(id, val, parse) => {
                                const parsedVal = parse ? parse(val) : val;
                                updateStepOptions(step.id, { ...step.options, [id]: parsedVal });
                              }}
                              sourceCanvas={originalCanvas}
                              activeTab={activeStepCategories[step.id]}
                              onTabChange={(tabId) => setActiveStepCategories(prev => ({ ...prev, [step.id]: tabId }))}
                            />
                         </div>
                     </div>
                 );
             })
         )}
      </div>

      <div className="actions-row">
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Primary Action Button */}
          <button
            className="btn btn-primary btn-large"
            onClick={() => {
              const allDone = workflow.items.length > 0 && workflow.items.every(i => i.status === 'done');
              onProcess({}, { forceReset: allDone });
            }}
            disabled={workflowSteps.length === 0 || workflow.items.length === 0}
          >
            {workflow.items.length > 0 && workflow.items.every(i => i.status === 'done') 
              ? '🔄 Rerun Workflow Pipeline' 
              : (workflow.items.some(i => i.status === 'done') ? '🚀 Run Pending' : '🚀 Run Workflow Pipeline')}
          </button>

          {/* Secondary Rerun All Button (only visible if some but not all items are done) */}
          {workflow.items.some(i => i.status === 'done') && !workflow.items.every(i => i.status === 'done') && (
             <button
              className="btn btn-secondary btn-large"
              onClick={() => onProcess({}, { forceReset: true })}
              disabled={workflowSteps.length === 0}
            >
              🔄 Rerun All
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;

