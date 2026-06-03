import { useController, useService, useWorkspace, useSegmentation } from "../../store";
import { useSAM } from "../../hooks/useSAM";
import { OPERATION_MODE } from "../../config/app";
import { CONTROLS_CONFIG } from "../../config/controls";
import React, { useEffect, useRef } from "react";
import ControlRenderer from "./ControlRenderer";
import Select from "../ui/Select";
import Slider from "../ui/Slider";
import Button from "../ui/Button";
import {
  useCompressionEstimator,
  useFileConversionSync,
} from "./useServiceEffects";
import { formatFileSize } from "../../core/canvas-utils";
import BatchSettingsSelector from "./BatchSettingsSelector";

// --- Sub-components for better structural design and layout separation ---

const CompressionStats = ({ originalFile, estimatedSize }) => {
  if (!originalFile) return null;
  return (
    <div className="full-width-control stats-overlay">
      <div className="workflow-compression-stats">
        <div className="workflow-stat-row">
          <span className="workflow-stat-label">Original Size:</span>
          <span className="workflow-stat-value">
            {formatFileSize(originalFile.size)}
          </span>
        </div>
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
  );
};

const ObjectSegmentationPointsClear = ({ clearPoints }) => {
  return (
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
  );
};

const BatchActionsPanel = ({ batch, serviceSettings, currentServiceId }) => {
  return (
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
              batch.rerunAll(serviceSettings[currentServiceId]);
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
  );
};

const ManualTouchupControls = ({ editing, setEditing }) => {
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
};

// --- Main ControlPanel component ---

const ControlPanel = () => {
  const { currentService, serviceSettings, updateServiceSetting } = useService();
  const { originalCanvas, resultCanvas, originalFile, isProcessing } = useWorkspace();

  const { executeSmartSelect, clearPoints } = useSAM();
  const batch = useController();
  const { execute, mode } = batch;

  const currentTab = useSegmentation((state) => state.activeEditorTab);
  const setCurrentTab = useSegmentation((state) => state.setActiveEditorTab);
  const editing = useSegmentation((state) => state.editing);
  const setEditing = useSegmentation((state) => state.setEditing);
  const magicEraseMaskCanvas = useSegmentation((state) => state.magicEraseMaskCanvas);

  const activeMode = mode;
  const bgPostProcessDebounceRef = useRef(null);

  // Dedicated effects hooks to sync stats and layouts dynamically
  const estimatedSize = useCompressionEstimator(
    currentService.id === "compression" ? serviceSettings["compression"] : null,
    originalCanvas,
  );

  const handleControlChange = React.useCallback((id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;

    if (batch.batchSettingsTarget && batch.batchSettingsTarget !== "all") {
      batch.updateItemOverride(batch.batchSettingsTarget, currentService.id, id, parsedVal);
      return;
    }

    const nextSettings = {
      ...(serviceSettings[currentService.id] || {}),
      [id]: parsedVal,
    };

    updateServiceSetting(currentService.id, id, parsedVal);

    const isBgRemovalPostProcessControl =
      currentService.id === "background-removal" &&
      ["edgeShift", "edgeSmoothness", "edgeContrast"].includes(id);

    if (isBgRemovalPostProcessControl && originalCanvas && resultCanvas) {
      clearTimeout(bgPostProcessDebounceRef.current);
      bgPostProcessDebounceRef.current = setTimeout(() => {
        execute({ ...nextSettings, _postProcess: true });
      }, 80);
    }
  }, [currentService.id, serviceSettings, updateServiceSetting, originalCanvas, resultCanvas, execute]);

  useEffect(() => {
    return () => clearTimeout(bgPostProcessDebounceRef.current);
  }, []);

  useFileConversionSync(
    currentService.id === "file-conversion" ? serviceSettings["file-conversion"] : null,
    handleControlChange,
  );

  // Derive configurations dynamically
  const configs = CONTROLS_CONFIG[currentService.id] || [];
  
  const categories = [...new Set(configs.filter((c) => c.category).map((c) => c.category))];

  const hasCategories = categories.length > 0;

  const filteredConfigs = hasCategories
    ? configs.filter((c) => c.category === (currentTab || categories[0]))
    : configs;

  const showManualTouchup = ["background-removal", "object-segmentation"].includes(currentService.id);

  const getProcessAction = () => {
    if (currentService.id === "object-segmentation") return executeSmartSelect;
    if (currentService.id === "magic-erase") {
      return () =>
        execute({
          ...serviceSettings[currentService.id],
          maskCanvas: magicEraseMaskCanvas,
        });
    }

    if (batch.batchSettingsTarget && batch.batchSettingsTarget !== "all") {
      return () => batch.executeSingleItemInBatch(currentService.id, serviceSettings[currentService.id] || {});
    }

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
    if (currentService.id === "object-segmentation") return "Segment Selected Points";

    if (batch.batchSettingsTarget && batch.batchSettingsTarget !== "all") {
      const idx = batch.items.findIndex(i => i.id === batch.batchSettingsTarget);
      return `Process Image ${idx + 1}`;
    }

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
      {activeMode === OPERATION_MODE.BATCH && <BatchSettingsSelector />}
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
              (config) => {
                const globalVal = serviceSettings[currentService.id]?.[config.id] ?? config.defaultValue;
                const activeVal =
                  batch.batchSettingsTarget !== "all"
                    ? (batch.items.find((i) => i.id === batch.batchSettingsTarget)?.settingsOverrides?.[currentService.id]?.[config.id] ?? globalVal)
                    : globalVal;

                return (
                  (!config.visibleIf || config.visibleIf(serviceSettings[currentService.id] || {})) && (
                    <ControlRenderer
                      key={config.id}
                      control={config}
                      value={activeVal}
                      onChange={handleControlChange}
                    />
                  )
                );
              }
            )}

            {/* Specialized Overlays */}
            {currentService.id === "compression" && (
              <CompressionStats originalFile={originalFile} estimatedSize={estimatedSize} />
            )}

            {currentService.id === "object-segmentation" && (
              <ObjectSegmentationPointsClear clearPoints={clearPoints} />
            )}
          </div>
        </div>

        {activeMode === OPERATION_MODE.BATCH && batch.items.length > 0 && (
          <BatchActionsPanel
            batch={batch}
            serviceSettings={serviceSettings}
            currentServiceId={currentService.id}
          />
        )}
      </div>

      {showManualTouchup && (
        <ManualTouchupControls editing={editing} setEditing={setEditing} />
      )}

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

export default ControlPanel;
