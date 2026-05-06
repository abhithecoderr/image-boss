import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';
import { CONTROLS_CONFIG } from '../config/controls';
import ControlRenderer from './shared/ControlRenderer';

const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};


const WorkflowBuilder = ({ workflow, onProcess }) => {
  const { originalFile, originalCanvas } = useApp();
  const { workflowSteps, addStep, removeStep, updateStepOptions, reorderSteps, previewStep, downloadStep } = workflow;
  const [activeStepCategories, setActiveStepCategories] = React.useState({});
  // Map of { [stepId]: estimatedBytes } from real toBlob calls
  const [stepEstimates, setStepEstimates] = useState({});
  const debounceRefs = useRef({});

  // Recompute real estimates for compression steps whenever quality or canvas changes
  useEffect(() => {
    workflowSteps.forEach(step => {
      if (step.serviceId !== 'compression' || !originalCanvas) return;
      const quality = (step.options.quality ?? 80) / 100;
      clearTimeout(debounceRefs.current[step.id]);
      debounceRefs.current[step.id] = setTimeout(() => {
        originalCanvas.toBlob(
          (blob) => {
            if (blob) setStepEstimates(prev => ({ ...prev, [step.id]: blob.size }));
          },
          'image/jpeg',
          quality
        );
      }, 150);
    });
    return () => Object.values(debounceRefs.current).forEach(clearTimeout);
  }, [workflowSteps, originalCanvas]);

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
    <div className="controls" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="workflow-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#333', padding: '12px 16px', borderRadius: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Workflow Pipeline</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85em', color: '#888' }}>Add Step:</span>
          <select
            className="control-select"
            onChange={handleAddStep}
            style={{ width: 'auto', padding: '4px 8px', height: '32px' }}
            value=""
          >
              <option value="" disabled>Select Service...</option>
              {availableServices.map(id => (
                  <option key={id} value={id}>{SERVICES[id].name}</option>
              ))}
          </select>
        </div>
      </div>

      <div className="workflow-steps" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
         {workflowSteps.length === 0 ? (
             <p className="control-hint" style={{ textAlign: 'center', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                 No steps added. Build your pipeline above.
             </p>
         ) : (
             workflowSteps.map((step, index) => {
                 const stepConfig = CONTROLS_CONFIG[step.serviceId] || [];
                 const service = SERVICES[step.serviceId];

                 return (
                     <div key={step.id} style={{
                         background: '#2a2a2a',
                         border: '1px solid #444',
                         borderRadius: '8px',
                         padding: '12px'
                     }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                             <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 <span style={{
                                     background: '#444', color: '#fff', borderRadius: '50%', width: '20px', height: '20px',
                                     display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7em'
                                 }}>{index + 1}</span>
                                 {service.icon} {service.name}
                             </strong>
                             <div style={{ display: 'flex', gap: '4px' }}>
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
                                     className="btn btn-secondary btn-tiny"
                                     style={{ color: '#ff4444' }}
                                     onClick={() => removeStep(step.id)}
                                 >✖</button>
                             </div>
                         </div>

                         <div className="step-controls">
                             {service.id === 'image-editor' && (
                                  <div className="tab-group control-tabs" style={{ marginBottom: '12px', gap: '4px', gridColumn: '1 / -1' }}>
                                     {[
                                         { id: 'composition', label: 'Comp' },
                                         { id: 'light', label: 'Light' },
                                         { id: 'color', label: 'Color' },
                                         { id: 'effects', label: 'Effects' },
                                         { id: 'filters', label: 'Filters' }
                                     ].map(tab => (
                                         <button
                                             key={tab.id}
                                             className={`btn btn-secondary btn-tiny ${(activeStepCategories[step.id] || 'composition') === tab.id ? 'active' : ''}`}
                                             onClick={() => setActiveStepCategories(prev => ({ ...prev, [step.id]: tab.id }))}
                                             style={{ flex: 1, fontSize: '10px' }}
                                         >
                                             {tab.label}
                                         </button>
                                     ))}
                                 </div>
                             )}
                             {stepConfig
                               .filter(config => service.id !== 'image-editor' || config.category === (activeStepCategories[step.id] || 'composition'))
                               .map(config => (
                                 (!config.visibleIf || config.visibleIf(step.options)) && (
                                   <ControlRenderer
                                     key={config.id}
                                     control={config}
                                     value={step.options[config.id]}
                                     onChange={(id, val, parse) => {
                                       const parsedVal = parse ? parse(val) : val;
                                       updateStepOptions(step.id, { ...step.options, [id]: parsedVal });
                                     }}
                                   />
                                 )
                               ))
                             }

                             {service.id === 'compression' && (
                               <div style={{
                                 gridColumn: '1 / -1',
                                 background: 'rgba(0,0,0,0.2)',
                                 padding: '10px',
                                 borderRadius: '6px',
                                 marginTop: '8px',
                                 fontSize: '0.8em',
                                 display: 'flex',
                                 flexDirection: 'column',
                                 gap: '4px'
                               }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                   <span style={{ color: '#888' }}>Original:</span>
                                   <span>
                                     {(() => {
                                       const item = workflow.items.find(i => i.id === workflow.activeItemId);
                                       const file = item?.file || originalFile;
                                       return file ? formatBytes(file.size) : '---';
                                     })()}
                                   </span>
                                 </div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                   <span style={{ color: '#888' }}>Est. Final:</span>
                                   <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                                     {stepEstimates[step.id] != null ? formatBytes(stepEstimates[step.id]) : '...'}
                                   </span>
                                 </div>
                               </div>
                             )}

                             {stepConfig.length === 0 && <span style={{ fontSize: '0.85em', color: '#888' }}>No options required</span>}
                         </div>
                     </div>
                 );
             })
         )}
      </div>

      <div className="actions-row">
        <button
          className="btn btn-primary btn-large"
          onClick={onProcess}
          disabled={workflowSteps.length === 0}
        >
          🚀 Run Workflow Pipeline
        </button>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
