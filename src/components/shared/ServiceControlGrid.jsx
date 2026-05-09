import React from 'react';
import { useApp } from '../../context/AppContext';
import { useSAM } from '../../hooks/useSAM';
import { CONTROLS_CONFIG } from '../../config/controls';

import ControlRenderer from './ControlRenderer';
import { useServiceEffects } from '../../hooks/useServiceEffects';
import { formatFileSize } from '../../core/ui-utils';

/**
 * ServiceControlGrid — A unified component that renders controls for any service.
 * It handles categorization (tabs), side effects, and conditional visibility.
 * 
 * @param {string} serviceId - The ID of the service to render controls for.
 * @param {Object} options - The current options/settings for this service.
 * @param {Function} onChange - Callback when a control value changes (id, value, parse).
 * @param {Canvas} sourceCanvas - Used for side-effects like estimation.
 * @param {Canvas} resultCanvas - Used for side-effects like post-processing.
 */
const ServiceControlGrid = ({ 
  serviceId, 
  options = {}, 
  onChange, 
  sourceCanvas, 
  resultCanvas,
  activeTab,
  onTabChange
}) => {
  const { activeEditorTab: globalTab, setActiveEditorTab: setGlobalTab, originalFile } = useApp();
  
  const currentTab = activeTab || globalTab;
  const setCurrentTab = onTabChange || setGlobalTab;
  const { clearPoints } = useSAM();

  
  // Activate side effects (estimation, post-processing, etc.)
  const { estimatedSize } = useServiceEffects(serviceId, options, sourceCanvas, resultCanvas, onChange);

  const configs = CONTROLS_CONFIG[serviceId];
  if (!configs) return null;

  // Filter by category if the service has them (e.g., image-editor)
  const categories = [...new Set(configs.filter(c => c.category).map(c => c.category))];
  const hasCategories = categories.length > 0;
  
  const filteredConfigs = hasCategories 
    ? configs.filter(c => c.category === (currentTab || categories[0]))
    : configs;

  return (
    <div className="service-control-grid">
      {/* Category Tabs (if applicable) */}
      {hasCategories && (
        <div className="control-group editor-categories-box" style={{ gridColumn: '1 / -1' }}>
          <div className="tab-group control-tabs" style={{ width: '100%', justifyContent: 'space-between' }}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`btn btn-secondary tab-item ${currentTab === cat ? 'active' : ''}`}
                onClick={() => setCurrentTab(cat)}
                style={{ flex: 1, fontSize: '12px', padding: '8px 4px', textTransform: 'capitalize' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Control List */}
      {filteredConfigs.map(config => (
        (!config.visibleIf || config.visibleIf(options)) && (
          <ControlRenderer
            key={config.id}
            control={config}
            value={options[config.id] ?? config.defaultValue}
            onChange={onChange}
          />
        )
      ))}

      {/* Specialized Overlays (e.g., Compression Stats) */}
      {serviceId === 'compression' && (
        <div className="control-group stats-overlay" style={{ gridColumn: '1 / -1' }}>
          <div className="workflow-compression-stats" style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            {originalFile && (
              <div className="workflow-stat-row">
                <span className="workflow-stat-label">Original Size:</span>
                <span className="workflow-stat-value" style={{ fontWeight: 'normal', color: 'var(--text-secondary)', opacity: 0.8 }}>
                  {formatFileSize(originalFile.size)}
                </span>
              </div>
            )}
            {estimatedSize && (
              <div className="workflow-stat-row">
                <span className="workflow-stat-label">Est. Final:</span>
                <span className="workflow-stat-success" style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                  {formatFileSize(estimatedSize)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Specialized Overlays (e.g., Object Segmentation point clearing) */}
      {serviceId === 'object-segmentation' && (
        <div className="control-group" style={{ gridColumn: '1 / -1', alignItems: 'flex-end' }}>
          <button className="btn btn-secondary btn-tiny" onClick={clearPoints}>
            🎯 Clear Selection Points
          </button>
        </div>
      )}
    </div>
  );
};


export default ServiceControlGrid;
