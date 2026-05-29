import { useService, useWorkspace, useSegmentation } from "../../context/AppContext";
import { useUnifiedProcessor } from "../../hooks/useUnifiedProcessor";
import { useSAM } from "../../hooks/useSAM";
import { OPERATION_MODE } from "../../config/app";
import { CONTROLS_CONFIG } from "../../config/controls";
import React from "react";
import ControlRenderer from "./ControlRenderer";
import Select from "../ui/Select";
import Slider from "../ui/Slider";
import Button from "../ui/Button";
import {
  useCompressionEstimator,
  useBgRemovalPostProcessor,
  useFileConversionSync,
} from "../../hooks/useServiceEffects";
import { formatFileSize } from "../../core/ui-utils";

const ControlPanel = () => {
  const { currentService, serviceSettings, updateServiceSetting } =
    useService();
  const { originalCanvas, resultCanvas, originalFile, isProcessing } = useWorkspace();
  const { executeSmartSelect, clearPoints } = useSAM();
  const { execute, engine: batch, mode } = useUnifiedProcessor();

  const { activeEditorTab: currentTab, setActiveEditorTab: setCurrentTab } =
    useSegmentation();

  const activeMode = mode;

  const estimatedSize = useCompressionEstimator(
    currentService.id === "compression" ? serviceSettings["compression"] : null,
    originalCanvas,
  );

  useBgRemovalPostProcessor(
    currentService.id === "background-removal" ? serviceSettings["background-removal"] : null,
    originalCanvas,
    resultCanvas,
  );

  const handleControlChange = (id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;
    updateServiceSetting(currentService.id, id, parsedVal);
  };

  useFileConversionSync(
    currentService.id === "file-conversion" ? serviceSettings["file-conversion"] : null,
    handleControlChange,
  );

  const configs = CONTROLS_CONFIG[currentService.id] || [];
  const categories = [
    ...new Set(configs.filter((c) => c.category).map((c) => c.category)),
  ];
  const hasCategories = categories.length > 0;

  const filteredConfigs = hasCategories
    ? configs.filter((c) => c.category === (currentTab || categories[0]))
    : configs;

  const showManualTouchup = [
    "background-removal",
    "object-segmentation",
  ].includes(currentService.id);

  const getProcessAction = () => {
    if (currentService.id === "object-segmentation") return executeSmartSelect;

    if (activeMode === OPERATION_MODE.BATCH) {
      const pending = batch.items.filter(
         (i) => i.status === "pending" || i.status === "error",
      ).length;
      if (pending > 0) {
        return () => execute(serviceSettings[currentService.id]);
      } else if (batch.items.length > 0) {
        return () => batch.rerunAll(serviceSettings[currentService.id]);
      }
    }

    return () => execute(serviceSettings[currentService.id]);
  };

  const getProcessLabel = () => {
    if (currentService.id === "object-segmentation")
      return "Segment Selected Points";

    if (activeMode === OPERATION_MODE.BATCH) {
      const pending = batch.items.filter(
        (i) => i.status === "pending" || i.status === "error",
      ).length;
      if (pending > 0) {
        return `Process All (${pending} image${pending !== 1 ? "s" : ""})`;
      } else if (batch.items.length > 0) {
        return `Rerun All (${batch.items.length} images)`;
      }
    }
    return "Process Image";
  };

  return (
    <div className="controls">
      <div className="controls-grid">
        {batch.batchAvailable && (
          <Select
            label="Mode"
            options={[
              { value: "single", label: "Single" },
              { value: "batch", label: "Batch" },
            ]}
            value={batch.mode}
            onChange={(val) => batch.setMode(val)}
          />
        )}

        <div className="full-width-control">
          {/* Category Tabs (if applicable) */}
          {hasCategories && (
            <div className="full-width-control editor-categories-box">
              <div className="tab-group control-tabs">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={currentTab === cat ? "primary" : "secondary"}
                    className={`tab-item ${currentTab === cat ? "active" : ""}`}
                    onClick={() => setCurrentTab(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Control List */}
          <div className="service-control-grid">
            {filteredConfigs.map(
              (config) =>
                (!config.visibleIf || config.visibleIf(serviceSettings[currentService.id] || {})) && (
                  <ControlRenderer
                    key={config.id}
                    control={config}
                    value={serviceSettings[currentService.id]?.[config.id] ?? config.defaultValue}
                    onChange={handleControlChange}
                  />
                ),
            )}

            {/* Specialized Overlays (e.g., Compression Stats) */}
            {currentService.id === "compression" && (
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
            {currentService.id === "object-segmentation" && (
              <div
                className="full-width-control"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "8px",
                }}
              >
                <Button
                  variant="secondary"
                  size="tiny"
                  onClick={clearPoints}
                  icon={
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                  }
                >
                  Clear Selection Points
                </Button>
              </div>
            )}
          </div>
        </div>

        {activeMode === OPERATION_MODE.BATCH && batch.items.length > 0 && (
          <div
            className="control-group"
            style={{ alignItems: "flex-end", justifyContent: "flex-end" }}
          >
            <label className="control-label">Batch Actions</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <Button
                variant="secondary"
                size="tiny"
                onClick={batch.selectAllItems}
              >
                Select All
              </Button>
              <Button
                variant="secondary"
                size="tiny"
                onClick={batch.deselectAllItems}
              >
                Deselect All
              </Button>
              <Button
                variant="secondary"
                size="tiny"
                onClick={() => {
                  if (
                    confirm(
                      "Clear all batch results? This marks them as pending for rerunning.",
                    )
                  ) {
                    batch.rerunAll(serviceSettings[currentService.id]);
                  }
                }}
                icon={
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                }
              >
                Reset
              </Button>
            </div>
          </div>
        )}
      </div>

      {showManualTouchup && <ManualTouchupControls />}

      <div className="actions-row">
        <Button
          variant="primary"
          size="large"
          onClick={getProcessAction()}
          disabled={
            (activeMode === OPERATION_MODE.BATCH && batch.items.length === 0) || isProcessing
          }
          isLoading={isProcessing}
        >
          {getProcessLabel()}
        </Button>
      </div>
    </div>
  );
};

const ManualTouchupControls = React.memo(() => {
  const { editing, setEditing } = useSegmentation();

  return (
    <div className="control-group control-section-divider">
      <label className="control-label" style={{ marginBottom: "12px" }}>
        Manual Mask Touch-up
      </label>
      <div className="control-manual-touchup">
        <div className="tab-group control-tabs">
          <Button
            variant={editing.activeTool === "none" ? "primary" : "secondary"}
            className={editing.activeTool === "none" ? "active" : ""}
            onClick={() =>
              setEditing((prev) => ({ ...prev, activeTool: "none" }))
            }
          >
            Move
          </Button>
          <Button
            variant={editing.activeTool === "erase" ? "primary" : "secondary"}
            className={editing.activeTool === "erase" ? "active" : ""}
            onClick={() =>
              setEditing((prev) => ({ ...prev, activeTool: "erase" }))
            }
          >
            Erase
          </Button>
          <Button
            variant={editing.activeTool === "restore" ? "primary" : "secondary"}
            className={editing.activeTool === "restore" ? "active" : ""}
            onClick={() =>
              setEditing((prev) => ({ ...prev, activeTool: "restore" }))
            }
          >
            Restore
          </Button>
        </div>

        {editing.activeTool !== "none" && (
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
  );
});

export default React.memo(ControlPanel);
