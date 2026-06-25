/*
 * Main workspace sidebar housing settings, models, sliders, and batch settings for the active service.
 */
import { useService, useWorkspace, useSegmentation, useUI, useAuth } from "../../store";
import { useUnifiedProcessor as useController } from "../../hooks/useUnifiedProcessor";

import { useSAM } from "../../hooks/useSAM";
import { OPERATION_MODE } from "../../config/app";
import { CONTROLS_CONFIG } from "../../config/controls";
import { BACKGROUND_REMOVAL_MODELS, SEGMENTATION_MODELS, CAPTIONING_MODELS, UPSCALING_MODELS } from "../../config/models";
import React, { useEffect, useRef, useState } from "react";
import ControlRenderer from "./ControlRenderer";
import Select from "../ui/Select";
import Slider from "../ui/Slider";
import Button from "../ui/Button";
import {
  useCompressionEstimator,
  useFileConversionSync,
} from "./useServiceEffects";
import { formatFileSize } from "../../utils/canvas-utils";
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
  const [resetPending, setResetPending] = useState(false);
  const resetTimerRef = useRef(null);

  const handleResetClick = () => {
    if (resetPending) {
      // Second click within the window — execute
      clearTimeout(resetTimerRef.current);
      setResetPending(false);
      batch.rerunAll(serviceSettings[currentServiceId]);
    } else {
      // First click — arm the confirmation
      setResetPending(true);
      resetTimerRef.current = setTimeout(() => setResetPending(false), 3000);
    }
  };

  useEffect(() => () => clearTimeout(resetTimerRef.current), []);

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
          variant={resetPending ? "primary" : "secondary"}
          size="tiny"
          onClick={handleResetClick}
          icon={
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          }
        >
          {resetPending ? "Confirm Reset?" : "Reset"}
        </Button>
      </div>
    </div>
  );
};

// --- Main ControlPanel component ---

const ControlPanel = () => {
  const { currentService, serviceSettings, updateServiceSetting } = useService();
  const { originalCanvas, resultCanvas, originalFile, isProcessing } = useWorkspace();
  const { user, hasPaidAccess } = useAuth();

  // Force tier back to free if an unauthorized user has it set to paid
  useEffect(() => {
    if (!hasPaidAccess && serviceSettings[currentService.id]?.tier === "paid") {
      updateServiceSetting(currentService.id, "tier", "free");
      if (currentService.id === "background-removal") {
        updateServiceSetting(currentService.id, "model", "birefnet-lite");
      } else if (currentService.id === "upscaling") {
        updateServiceSetting(currentService.id, "modelId", "esrgan");
      } else if (currentService.id === "object-segmentation") {
        updateServiceSetting(currentService.id, "modelId", "onnx-community/sam2.1-hiera-tiny-ONNX");
      }
    }
  }, [hasPaidAccess, currentService.id, serviceSettings, updateServiceSetting]);

  const { executeSmartSelect, clearPoints } = useSAM();

  const batch = useController();
  const { execute, mode } = batch;

  const currentTab = useUI((state) => state.activeEditorTab);
  const setCurrentTab = useUI((state) => state.setActiveEditorTab);
  const editing = useSegmentation((state) => state.editing);
  const setEditing = useSegmentation((state) => state.setEditing);
  const magicEraseMaskCanvas = useSegmentation((state) => state.magicEraseMaskCanvas);
  const isGeneratingMask = useSegmentation((state) => state.isGeneratingMask);

  // --- Image Editor Settings History (Undo/Redo) ---
  const [editorHistory, setEditorHistory] = useState([]);
  const [editorHistoryIndex, setEditorHistoryIndex] = useState(-1);
  const isUndoRedoingRef = useRef(false);

  // Initialize history when image-editor mounts or settings load
  useEffect(() => {
    if (currentService.id === "image-editor" && serviceSettings["image-editor"]) {
      const currentSettingsStr = JSON.stringify(serviceSettings["image-editor"]);
      setEditorHistory([currentSettingsStr]);
      setEditorHistoryIndex(0);
    }
  }, [currentService.id]);

  const activeMode = mode;
  const bgPostProcessDebounceRef = useRef(null);

  // Dedicated effects hooks to sync stats and layouts dynamically
  const estimatedSize = useCompressionEstimator(
    currentService.id === "compression" ? serviceSettings["compression"] : null,
    originalCanvas,
  );

  const handleControlChange = (id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;

    if (batch.batchSettingsTarget && batch.batchSettingsTarget !== "all") {
      batch.updateItemOverride(batch.batchSettingsTarget, currentService.id, id, parsedVal);
      if (currentService.id === "background-removal" && id === "model") {
        const modelCfg = BACKGROUND_REMOVAL_MODELS[parsedVal];
        if (modelCfg && modelCfg.method !== "hybrid") {
          batch.updateItemOverride(batch.batchSettingsTarget, currentService.id, "method", modelCfg.method);
        }
      }
      if (id === "tier" && parsedVal === "paid") {
        const currentOverrides = batch.items.find((i) => i.id === batch.batchSettingsTarget)?.settingsOverrides?.[currentService.id] || {};
        const globalSettings = serviceSettings[currentService.id] || {};
        if (currentService.id === "background-removal") {
          const activeModel = currentOverrides.model ?? globalSettings.model;
          if (activeModel !== "birefnet" && activeModel !== "birefnet-lite" && activeModel !== "ben2") {
            batch.updateItemOverride(batch.batchSettingsTarget, currentService.id, "model", "birefnet-lite");
          }
        } else if (currentService.id === "upscaling") {
          const activeModelId = currentOverrides.modelId ?? globalSettings.modelId;
          if (activeModelId !== "esrgan") {
            batch.updateItemOverride(batch.batchSettingsTarget, currentService.id, "modelId", "esrgan");
          }
        }
      }
      return;
    }

    const nextSettings = {
      ...(serviceSettings[currentService.id] || {}),
      [id]: parsedVal,
    };

    updateServiceSetting(currentService.id, id, parsedVal);

    // Track history for image editor
    if (currentService.id === "image-editor" && !isUndoRedoingRef.current) {
      const updatedHistory = editorHistory.slice(0, editorHistoryIndex + 1);
      const settingsStr = JSON.stringify(nextSettings);
      if (updatedHistory[updatedHistory.length - 1] !== settingsStr) {
        updatedHistory.push(settingsStr);
        setEditorHistory(updatedHistory);
        setEditorHistoryIndex(updatedHistory.length - 1);
      }
    }

    if (id === "tier" && parsedVal === "paid") {
      if (currentService.id === "background-removal") {
        const currentModel = nextSettings.model;
        if (currentModel !== "birefnet" && currentModel !== "birefnet-lite" && currentModel !== "ben2") {
          updateServiceSetting(currentService.id, "model", "birefnet-lite");
          nextSettings.model = "birefnet-lite";
        }
      } else if (currentService.id === "upscaling") {
        const currentModelId = nextSettings.modelId;
        if (currentModelId !== "esrgan") {
          updateServiceSetting(currentService.id, "modelId", "esrgan");
          nextSettings.modelId = "esrgan";
        }
      }
    }

    if (currentService.id === "background-removal" && id === "model") {
      const modelCfg = BACKGROUND_REMOVAL_MODELS[parsedVal];
      if (modelCfg && modelCfg.method !== "hybrid") {
        updateServiceSetting(currentService.id, "method", modelCfg.method);
        nextSettings.method = modelCfg.method;
      }
    }


    const isBgRemovalPostProcessControl =
      currentService.id === "background-removal" &&
      ["edgeShift", "edgeSmoothness", "edgeContrast"].includes(id);

    if (isBgRemovalPostProcessControl && originalCanvas && resultCanvas) {
      clearTimeout(bgPostProcessDebounceRef.current);
      bgPostProcessDebounceRef.current = setTimeout(() => {
        execute(nextSettings);
      }, 80);
    }
  };

  const handleEditorUndo = () => {
    if (editorHistoryIndex > 0) {
      isUndoRedoingRef.current = true;
      const prevIdx = editorHistoryIndex - 1;
      setEditorHistoryIndex(prevIdx);
      const targetSettings = JSON.parse(editorHistory[prevIdx]);
      Object.keys(targetSettings).forEach((key) => {
        updateServiceSetting("image-editor", key, targetSettings[key]);
      });
      setTimeout(() => {
        isUndoRedoingRef.current = false;
      }, 50);
    }
  };

  const handleEditorRedo = () => {
    if (editorHistoryIndex < editorHistory.length - 1) {
      isUndoRedoingRef.current = true;
      const nextIdx = editorHistoryIndex + 1;
      setEditorHistoryIndex(nextIdx);
      const targetSettings = JSON.parse(editorHistory[nextIdx]);
      Object.keys(targetSettings).forEach((key) => {
        updateServiceSetting("image-editor", key, targetSettings[key]);
      });
      setTimeout(() => {
        isUndoRedoingRef.current = false;
      }, 50);
    }
  };

  const handleEditorReset = () => {
    const defaults = {};
    CONTROLS_CONFIG["image-editor"].forEach((control) => {
      if (control.defaultValue !== undefined) {
        defaults[control.id] = control.defaultValue;
        updateServiceSetting("image-editor", control.id, control.defaultValue);
      }
    });

    const settingsStr = JSON.stringify(defaults);
    const updatedHistory = editorHistory.slice(0, editorHistoryIndex + 1);
    updatedHistory.push(settingsStr);
    setEditorHistory(updatedHistory);
    setEditorHistoryIndex(updatedHistory.length - 1);
  };

  useEffect(() => {
    return () => clearTimeout(bgPostProcessDebounceRef.current);
  }, []);

  useFileConversionSync(
    currentService.id === "file-conversion" ? serviceSettings["file-conversion"] : null,
    handleControlChange,
  );

  // Derive configurations dynamically
  const configs = (CONTROLS_CONFIG[currentService.id] || []).filter((c) => {
    if (c.id === "tier" && !hasPaidAccess) return false;
    return true;
  });
  
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
      const targetItem = batch.items[idx];
      const prefix = (targetItem?.status === "done" || targetItem?.resultCanvas) ? "Process again" : "Process Image";
      return `${prefix} ${idx + 1}`;
    }

    if (activeMode === OPERATION_MODE.BATCH) {
      const pending = batch.items.filter(
        (i) => i.status === "pending" || i.status === "error",
      ).length;
      if (pending > 0) {
        return `Process All (${pending} image${pending !== 1 ? "s" : ""})`;
      } else if (batch.items.length > 0) {
        return `Process again (${batch.items.length} images)`;
      }
    }
    return "Process Image";
  };

  return (
    <>
      {activeMode === OPERATION_MODE.BATCH && batch.items.length > 0 && (
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "20px",
          marginBottom: "16px",
          width: "100%",
          position: "relative",
          zIndex: 10
        }}>
          <Button
            variant={isProcessing ? "secondary" : "primary"}
            onClick={isProcessing ? batch.cancel : getProcessAction()}
            style={{ padding: "6px 16px", fontSize: "13px" }}
          >
            {isProcessing ? "Pause" : getProcessLabel()}
          </Button>
        </div>
      )}

      <div className={`controls ${originalCanvas ? "has-image" : ""}`}>
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
              <div className="full-width-control editor-categories-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

                {currentService.id === "image-editor" && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '6px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        title="Undo"
                        onClick={handleEditorUndo}
                        disabled={editorHistoryIndex <= 0}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: editorHistoryIndex <= 0 ? 'var(--text-dim)' : 'var(--text-muted)',
                          borderRadius: 'var(--radius-sm)',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: editorHistoryIndex <= 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 7v6h6"/>
                          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        title="Redo"
                        onClick={handleEditorRedo}
                        disabled={editorHistoryIndex >= editorHistory.length - 1}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: editorHistoryIndex >= editorHistory.length - 1 ? 'var(--text-dim)' : 'var(--text-muted)',
                          borderRadius: 'var(--radius-sm)',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: editorHistoryIndex >= editorHistory.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 7v6h-6"/>
                          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                        </svg>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleEditorReset}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        fontSize: '10.5px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        border: '1px solid transparent',
                        borderRadius: 'var(--radius-sm)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--text-main)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      Reset adjustments
                    </button>
                  </div>
                )}
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

                  // Resolve options if it is a function
                  let resolvedControl = config;
                  if (typeof config.options === "function") {
                    const currentSettings = (batch.batchSettingsTarget !== "all"
                      ? {
                          ...serviceSettings[currentService.id],
                          ...(batch.items.find((i) => i.id === batch.batchSettingsTarget)?.settingsOverrides?.[currentService.id] || {})
                        }
                      : serviceSettings[currentService.id]) || {};

                    resolvedControl = {
                      ...config,
                      options: config.options(currentSettings),
                    };
                  }

                  // Dynamically strip paid options for non-developers / non-credited users
                  if (resolvedControl.options && Array.isArray(resolvedControl.options) && !hasPaidAccess) {
                    resolvedControl = {
                      ...resolvedControl,
                      options: resolvedControl.options.filter(opt => {
                        if (BACKGROUND_REMOVAL_MODELS[opt.value]?.paid) return false;
                        const segModel = Object.values(SEGMENTATION_MODELS).find(m => m.model_id === opt.value);
                        if (segModel?.paid) return false;
                        if (CAPTIONING_MODELS[opt.value]?.paid) return false;
                        if (UPSCALING_MODELS[opt.value]?.paid) return false;
                        return true;
                      })
                    };
                  }

                  return (
                    (!config.visibleIf || config.visibleIf(serviceSettings[currentService.id] || {})) && (
                      <ControlRenderer
                        key={config.id}
                        control={resolvedControl}
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
      </div>
    </>
  );
};

export default ControlPanel;
