import React from "react";
import { useSegmentation, useWorkspace } from "../../store";
import { useSAM } from "../../hooks/useSAM";
import { CONTROLS_CONFIG } from "../../config/controls";

import ControlRenderer from "./ControlRenderer";
import {
  useCompressionEstimator,
  useFileConversionSync,
} from "./useServiceEffects";

import { formatFileSize } from "../../core/canvas-utils";

const ServiceControlGrid = ({
  serviceId,
  options = {},
  onChange,
  sourceCanvas,
  resultCanvas,
  activeTab,
  onTabChange,
}) => {
  const { activeEditorTab: globalTab, setActiveEditorTab: setGlobalTab } =
    useSegmentation();
  const { originalFile } = useWorkspace();

  const currentTab = activeTab || globalTab;
  const setCurrentTab = onTabChange || setGlobalTab;
  const { clearPoints } = useSAM();

  // Run specialized effects hooks only when the corresponding service is active
  const estimatedSize = useCompressionEstimator(
    serviceId === "compression" ? options : null,
    serviceId === "compression" ? sourceCanvas : null,
  );

  useFileConversionSync(
    serviceId === "file-conversion" ? options : null,
    onChange,
  );

  const configs = CONTROLS_CONFIG[serviceId];
  if (!configs) return null;

  // Filter by category if the service has them (e.g., image-editor)
  const categories = [
    ...new Set(configs.filter((c) => c.category).map((c) => c.category)),
  ];
  const hasCategories = categories.length > 0;

  const filteredConfigs = hasCategories
    ? configs.filter((c) => c.category === (currentTab || categories[0]))
    : configs;

  return (
    <div className="service-control-grid">
      {/* Category Tabs (if applicable) */}
      {hasCategories && (
        <div className="full-width-control editor-categories-box">
          <div className="tab-group control-tabs">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`btn btn-secondary tab-item ${currentTab === cat ? "active" : ""}`}
                onClick={() => setCurrentTab(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Control List */}
      {filteredConfigs.map((config) => {
        let resolvedControl = config;
        if (typeof config.options === "function") {
          resolvedControl = {
            ...config,
            options: config.options(options || {}),
          };
        }

        return (
          (!config.visibleIf || config.visibleIf(options)) && (
            <ControlRenderer
              key={config.id}
              control={resolvedControl}
              value={options[config.id] ?? config.defaultValue}
              onChange={onChange}
            />
          )
        );
      })}

      {/* Specialized Overlays (e.g., Compression Stats) */}
      {serviceId === "compression" && (
        <div className="full-width-control stats-overlay">
          <div className="workflow-compression-stats">
            {originalFile && (
              <div className="workflow-stat-row">
                <span className="workflow-stat-label">Original Size:</span>
                <span className="workflow-stat-value">
                  {formatFileSize(originalFile.size)}
                </span>
              </div>
            )}
            {estimatedSize && (
              <div className="workflow-stat-row">
                <span className="workflow-stat-label">Est. Final:</span>
                <span className="workflow-stat-success">
                  {formatFileSize(estimatedSize)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Specialized Overlays (e.g., Object Segmentation point clearing) */}
      {serviceId === "object-segmentation" && (
        <div
          className="full-width-control"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "8px",
          }}
        >
          <button className="btn btn-secondary btn-tiny" onClick={clearPoints}>
            🎯 Clear Selection Points
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceControlGrid;
