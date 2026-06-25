/*
 * Central canvas workstation displaying the comparison slider, overlays, processing state, and batch stripes.
 */
import React, { useRef, useEffect, useState } from "react";
import { useUI, useWorkspace, useService, useSegmentation } from "../../store";
import { useUnifiedProcessor } from "../../hooks/useUnifiedProcessor";
import { useFileUpload } from "../../hooks/useFileUpload";
import SAMOverlay from "./overlays/SAMOverlay";
import SegmentationCandidates from "./SegmentationCandidates";
import ComparisonSlider from "./ComparisonSlider";
import MaskEditorOverlay from "./overlays/MaskEditorOverlay";
import MagicEraseOverlay from "./overlays/MagicEraseOverlay";
import EditorPreview from "./EditorPreview";
import BatchStrip from "./BatchStrip";
import { downloadCanvas } from "../../utils/canvas-utils";
import Progress from "../ui/Progress";
import UploadZone from "../ui/UploadZone";
import Button from "../ui/Button";
import { useSAM } from "../../hooks/useSAM";

/**
 * Release a single canvas's backing store. Works for HTMLCanvasElement
 * (zero its size), OffscreenCanvas, and ImageBitmap (both have `.close()`).
 */
function disposeCanvas(canvas) {
  if (!canvas) return;
  if (typeof canvas.close === 'function') {
    try { canvas.close(); } catch (_) {}
  } else if (canvas.width !== undefined) {
    // HTMLCanvasElement — shrink to 0×0 to free the pixel buffer immediately.
    try { canvas.width = 0; canvas.height = 0; } catch (_) {}
  }
}

/** Dispose every canvas in a history stack before it's discarded, unless it is still in use. */
function disposeHistoryStack(stack, currentRes = null, currentSrc = null, itemsList = []) {
  if (!Array.isArray(stack)) return;
  for (const canvas of stack) {
    if (!canvas) continue;
    if (canvas === currentRes || canvas === currentSrc) continue;
    if (itemsList && itemsList.length > 0) {
      const isReferenced = itemsList.some((item) => {
        if (item.sourceCanvas === canvas || item.resultCanvas === canvas) return true;
        if (item.stepResults && Object.values(item.stepResults).some(res => res.resultCanvas === canvas)) return true;
        if (item.serviceResults && Object.values(item.serviceResults).some(res => res.resultCanvas === canvas)) return true;
        return false;
      });
      if (isReferenced) continue;
    }
    disposeCanvas(canvas);
  }
}

const StatusBar = () => {
  const { progress } = useUI();
  const isProcessing = useWorkspace((state) => state.isProcessing);
  if (!isProcessing) return null;
  return (
    <Progress
      percent={progress.percent}
      message={progress.message || "Processing..."}
      stage={progress.stage}
    />
  );
};

const Workspace = () => {
  const batch = useUnifiedProcessor();
  const { currentService, getDownloadMetadata, serviceSettings } = useService();
  const { executeSmartSelect } = useSAM();
  const magicEraseMaskCanvas = useSegmentation((state) => state.magicEraseMaskCanvas);

  const getProcessAction = () => {
    if (currentService.id === "object-segmentation") return executeSmartSelect;
    if (currentService.id === "magic-erase") {
      return () =>
        batch.execute({
          ...serviceSettings[currentService.id],
          maskCanvas: magicEraseMaskCanvas,
        });
    }
    return () => batch.execute(serviceSettings[currentService.id]);
  };

  const getProcessLabel = () => {
    if (currentService.id === "object-segmentation") return "Segment Selected Points";
    if (activeItem?.status === "done" || resCanvasState) {
      return "Process again";
    }
    return "Process Image";
  };
  
  const isProcessing = useWorkspace((state) => state.isProcessing);
  const resetImages = useWorkspace((state) => state.resetImages);
  const resetSegmentationState = useSegmentation((state) => state.resetSegmentationState);
  const isGeneratingMask = useSegmentation((state) => state.isGeneratingMask);
  const items = useWorkspace((state) => state.items);
  const activeItemId = useWorkspace((state) => state.activeItemId);
  const setResultCanvas = useWorkspace((state) => state.setResultCanvas);
  const editing = useSegmentation((state) => state.editing);
  const setEditing = useSegmentation((state) => state.setEditing);

  const activeItem = items.find((i) => i.id === activeItemId) || null;
  const srcCanvasState = activeItem?.sourceCanvas || null;
  const resCanvasState = activeItem?.resultCanvas || null;

  const [initialCanvasBackup, setInitialCanvasBackup] = useState(null);
  const [historyStack, setHistoryStack] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const latestStatesRef = useRef({ resCanvasState, srcCanvasState, items });
  useEffect(() => {
    latestStatesRef.current = { resCanvasState, srcCanvasState, items };
  }, [resCanvasState, srcCanvasState, items]);

  // Clean up segmentation points and candidates when switching services
  useEffect(() => {
    resetSegmentationState(currentService.id === "magic-erase");
    // Reset editing state on switch
    setEditing({ activeTool: "none" });
    setInitialCanvasBackup(null);
    const { resCanvasState: r, srcCanvasState: s, items: i } = latestStatesRef.current;
    disposeHistoryStack(historyStack, r, s, i);
    setHistoryStack([]);
    setHistoryIndex(-1);
  }, [currentService.id, resetSegmentationState, setEditing]);

  const handleReset = () => {
    resetImages();
    resetSegmentationState();
    setEditing({ activeTool: "none" });
    setInitialCanvasBackup(null);
    disposeHistoryStack(historyStack);
    setHistoryStack([]);
    setHistoryIndex(-1);
  };

  // When result canvas updates while editing, record it to history stack
  useEffect(() => {
    if (editing.activeTool !== "none" && resCanvasState) {
      if (historyStack[historyIndex] === resCanvasState) {
        return;
      }
      const newStack = historyStack.slice(0, historyIndex + 1);
      newStack.push(resCanvasState);
      setHistoryStack(newStack);
      setHistoryIndex(newStack.length - 1);
    }
  }, [resCanvasState, editing.activeTool]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setResultCanvas(historyStack[prevIndex], editing.activeStepId || null);
    } else if (historyIndex === 0 && initialCanvasBackup) {
      setHistoryIndex(-1);
      setResultCanvas(initialCanvasBackup, editing.activeStepId || null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setResultCanvas(historyStack[nextIndex], editing.activeStepId || null);
    }
  };

  const handleCancel = () => {
    if (initialCanvasBackup) {
      setResultCanvas(initialCanvasBackup, editing.activeStepId || null);
    }
    setEditing({ activeTool: "none" });
    setInitialCanvasBackup(null);
    // Note: we intentionally do NOT dispose the history stack here — its
    // entries may still be referenced by resultCanvas until GC reclaims them.
    // Disposal happens on reset / service-switch where all canvases are dropped.
    setHistoryStack([]);
    setHistoryIndex(-1);
  };

  const handleSave = () => {
    setEditing({ activeTool: "none" });
    setInitialCanvasBackup(null);
    setHistoryStack([]);
    setHistoryIndex(-1);
  };

  const startTouchupMode = () => {
    if (resCanvasState) {
      setInitialCanvasBackup(resCanvasState);
      setHistoryStack([resCanvasState]);
      setHistoryIndex(0);
      setEditing({ activeTool: "erase" });
    }
  };

  const { handleFile } = useFileUpload();
  const srcRef = useRef(null);
  const resRef = useRef(null);

  const isBatchView = batch.batchMode === "batch" || currentService.id === "workflows";
  const isWorkflowView = currentService.id === "workflows";
  const isMultiMode = isBatchView || isWorkflowView;

  const activeItemFromBatch = batch.items.find((i) => i.id === batch.activeItemId);
  const srcCanvas = activeItemFromBatch ? activeItemFromBatch.sourceCanvas : srcCanvasState;

  // Prioritize the resCanvasState (from useWorkspace) as it may contain
  // live edits or specific step previews. Fall back to the item's result.
  const resCanvas =
    resCanvasState || (activeItemFromBatch ? activeItemFromBatch.resultCanvas : null);

  // Sync state canvases to DOM canvases
  useEffect(() => {
    if (srcCanvas && srcRef.current) {
      const ctx = srcRef.current.getContext("2d");
      srcRef.current.width = srcCanvas.width;
      srcRef.current.height = srcCanvas.height;
      ctx.drawImage(srcCanvas, 0, 0);
    }
  }, [srcCanvas, currentService.id, resCanvasState]);

  useEffect(() => {
    if (!resRef.current) return;
    const ctx = resRef.current.getContext("2d");

    if (resCanvas) {
      resRef.current.width = resCanvas.width;
      resRef.current.height = resCanvas.height;

      const isValidSource =
        resCanvas instanceof HTMLCanvasElement ||
        resCanvas instanceof OffscreenCanvas ||
        resCanvas instanceof ImageBitmap;

      if (isValidSource) {
        ctx.drawImage(resCanvas, 0, 0);
      }
    } else {
      // Clear canvas if no result
      ctx.clearRect(0, 0, resRef.current.width, resRef.current.height);
    }
  }, [resCanvas, currentService.id, resCanvasState]);

  const onDrop = (files) => {
    if (isBatchView) {
      if (files.length > 0) {
        batch.addFiles(files);
      }
    } else {
      const file = files[0];
      if (file && file.type.startsWith("image/")) {
        handleFile(file);
      }
    }
  };

  const showUploadArea =
    !srcCanvas && (!isMultiMode || batch.items.length === 0);

  if (showUploadArea) {
    return (
      <UploadZone
        multiple={isBatchView}
        onFilesSelected={onDrop}
      />
    );
  }

  return (
    <div className="workspace">
      <StatusBar />

      {activeItem?.status === "error" && (
        <div className="workspace-error-banner" style={{
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          color: "#fca5a5",
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13px",
          animation: "fadeIn 0.2s ease-in-out"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#ef4444" }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "#ef4444", marginRight: "8px" }}>Processing Failed:</strong>
            {activeItem.error || "An unknown error occurred during execution."}
          </div>
        </div>
      )}

      {isBatchView && batch.items.length > 0 && (
        <BatchStrip />
      )}

      <div className="preview-container">
        {/* Render single viewport/layout if it's one of the reduced/single services */}
        {["background-removal", "upscaling", "blur", "line-art"].includes(currentService.id) ? (
          resCanvasState ? (
            /* Comparison Slider Panel */
            <div className="preview-panel">
              <div className="preview-label preview-header">
                <span>Comparison</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {resCanvasState && currentService.id === "background-removal" && editing.activeTool === "none" && (
                    <button
                      type="button"
                      title="Touch up result manually"
                      onClick={startTouchupMode}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        transition: 'all var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        e.currentTarget.style.color = 'var(--text-main)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                      </svg>
                      Touchup
                    </button>
                  )}
                  {editing.activeTool !== "none" && (
                    /* Touchup Active Toolbar */
                    <div className="editor-toolbar">
                      <div className="editor-toolbar-group">
                        <button
                          type="button"
                          title="Erase Mode (E)"
                          onClick={() => setEditing({ activeTool: "erase" })}
                          className={`editor-tool-btn${editing.activeTool === "erase" ? " is-active" : ""}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m14 3-4.9 4.9"/>
                            <path d="m8.5 8.5-5 5A2 2 0 0 0 5 17h10l5-5a2 2 0 0 0 0-2.8l-6-6Z"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Restore Mode (R)"
                          onClick={() => setEditing({ activeTool: "restore" })}
                          className={`editor-tool-btn${editing.activeTool === "restore" ? " is-active" : ""}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 22 .7-2.7a2 2 0 0 0-.5-1.7l-8.2-8.2A2 2 0 0 1 6.8 6.6l8.2 8.2a2 2 0 0 0 1.7.5L19.4 16A1 1 0 0 0 21 15.3l.5-4.5a3 3 0 0 0-.8-2.3L12 1.3A3 3 0 0 0 9.7.5L5.2 1a1 1 0 0 0-.7 1.5Z"/>
                          </svg>
                        </button>
                        <div className="editor-toolbar-divider" />
                        <div className="editor-brush-control">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Brush Size">
                            <circle cx="12" cy="12" r="8"/>
                            <circle cx="12" cy="12" r="3" fill="currentColor"/>
                          </svg>
                          <input
                            type="range"
                            min="5"
                            max="150"
                            value={editing.brushSize}
                            onChange={(e) => setEditing({ brushSize: parseInt(e.target.value) })}
                            className="editor-brush-range"
                          />
                          <span className="editor-brush-value">{editing.brushSize}px</span>
                        </div>
                      </div>
                      <div className="editor-toolbar-group">
                        <button
                          type="button"
                          title="Undo stroke"
                          onClick={handleUndo}
                          disabled={historyIndex < 0}
                          className="editor-tool-btn"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7v6h6"/>
                            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Redo stroke"
                          onClick={handleRedo}
                          disabled={historyIndex >= historyStack.length - 1}
                          className="editor-tool-btn"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 7v6h-6"/>
                            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                          </svg>
                        </button>
                        <div className="editor-toolbar-divider" />
                        <button
                          type="button"
                          title="Cancel changes"
                          onClick={handleCancel}
                          className="editor-tool-btn editor-tool-btn--danger"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Save changes"
                          onClick={handleSave}
                          className="editor-tool-btn editor-tool-btn--success"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  {editing.activeTool === "none" && (
                    <Button
                      variant="secondary"
                      size="tiny"
                      onClick={() => {
                        const { filename, mimeType } = getDownloadMetadata(
                          null,
                          null,
                          resCanvasState,
                        );
                        downloadCanvas(resCanvasState, filename, mimeType);
                      }}
                      icon={
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      }
                    >
                      Download
                    </Button>
                  )}
                </div>
              </div>
              <div className="preview-image-wrapper">
                {editing.activeTool !== "none" ? (
                  <>
                    <MaskEditorOverlay resRef={resRef} />
                    <canvas ref={resRef}></canvas>
                  </>
                ) : (
                  <ComparisonSlider />
                )}
              </div>
            </div>
          ) : (
            /* Original Image Panel before processing */
            <div className="preview-panel">
              <div className="preview-label preview-header">
                <span>Original</span>
              </div>
              <div
                className="preview-image-wrapper"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length > 0) {
                    onDrop(e.dataTransfer.files);
                  }
                }}
              >
                <canvas ref={srcRef}></canvas>
              </div>
            </div>
          )
        ) : ["compression", "file-conversion"].includes(currentService.id) ? (
          resCanvasState ? (
            /* Result Panel for Single-canvas (Compress/Convert) */
            <div className="preview-panel">
              <div className="preview-label preview-header">
                <span>Result</span>
                <Button
                  variant="secondary"
                  size="tiny"
                  onClick={() => {
                    const { filename, mimeType } = getDownloadMetadata(
                      null,
                      null,
                      resCanvasState,
                    );
                    downloadCanvas(resCanvasState, filename, mimeType);
                  }}
                  icon={
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  }
                >
                  Download
                </Button>
              </div>
              <div className="preview-image-wrapper">
                <canvas ref={resRef}></canvas>
              </div>
            </div>
          ) : (
            /* Original Panel for Single-canvas before processing */
            <div className="preview-panel">
              <div className="preview-label preview-header">
                <span>Original</span>
              </div>
              <div
                className="preview-image-wrapper"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length > 0) {
                    onDrop(e.dataTransfer.files);
                  }
                }}
              >
                <canvas ref={srcRef}></canvas>
              </div>
            </div>
          )
        ) : (
          /* Side-by-Side View for other services */
          <>
            <div className="preview-panel">
              <div className="preview-label preview-header">
                <span>Original</span>
              </div>

              <div
                className="preview-image-wrapper"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length > 0) {
                    onDrop(e.dataTransfer.files);
                  }
                }}
              >
                <SAMOverlay srcRef={srcRef} />
                <MagicEraseOverlay srcRef={srcRef} />
                <canvas ref={srcRef}></canvas>
              </div>
            </div>

            {currentService.id === "image-editor" ? (
              <div className="preview-panel">
                <div className="preview-label preview-header">
                  <span>Live Result</span>
                </div>
                <div className="preview-image-wrapper">
                  <EditorPreview sourceCanvas={srcCanvasState} />
                </div>
              </div>
            ) : (
              <div className="preview-panel">
                <div className="preview-label preview-header" style={{ position: 'relative', minHeight: '38px', display: 'flex', alignItems: 'center' }}>
                  {editing.activeTool !== "none" ? (
                    /* Editing Mode Toolbar */
                    <div className="editor-toolbar">
                      {/* Left Side: Tools & Brush Size */}
                      <div className="editor-toolbar-group">
                        {/* Erase Tool */}
                        <button
                          type="button"
                          title="Erase Mode (E)"
                          onClick={() => setEditing({ activeTool: "erase" })}
                          className={`editor-tool-btn${editing.activeTool === "erase" ? " is-active" : ""}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m14 3-4.9 4.9"/>
                            <path d="m8.5 8.5-5 5A2 2 0 0 0 5 17h10l5-5a2 2 0 0 0 0-2.8l-6-6Z"/>
                          </svg>
                        </button>

                        {/* Restore Tool */}
                        <button
                          type="button"
                          title="Restore Mode (R)"
                          onClick={() => setEditing({ activeTool: "restore" })}
                          className={`editor-tool-btn${editing.activeTool === "restore" ? " is-active" : ""}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 22 .7-2.7a2 2 0 0 0-.5-1.7l-8.2-8.2A2 2 0 0 1 6.8 6.6l8.2 8.2a2 2 0 0 0 1.7.5L19.4 16A1 1 0 0 0 21 15.3l.5-4.5a3 3 0 0 0-.8-2.3L12 1.3A3 3 0 0 0 9.7.5L5.2 1a1 1 0 0 0-.7 1.5Z"/>
                          </svg>
                        </button>

                        <div className="editor-toolbar-divider" />

                        {/* Brush Size Slider */}
                        <div className="editor-brush-control">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Brush Size">
                            <circle cx="12" cy="12" r="8"/>
                            <circle cx="12" cy="12" r="3" fill="currentColor"/>
                          </svg>
                          <input
                            type="range"
                            min="5"
                            max="150"
                            value={editing.brushSize}
                            onChange={(e) => setEditing({ brushSize: parseInt(e.target.value) })}
                            className="editor-brush-range"
                          />
                          <span className="editor-brush-value">{editing.brushSize}px</span>
                        </div>
                      </div>

                      {/* Right Side: Undo, Redo, Cancel, Save */}
                      <div className="editor-toolbar-group">
                        {/* Undo Button */}
                        <button
                          type="button"
                          title="Undo stroke"
                          onClick={handleUndo}
                          disabled={historyIndex < 0}
                          className="editor-tool-btn"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7v6h6"/>
                            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                          </svg>
                        </button>

                        {/* Redo Button */}
                        <button
                          type="button"
                          title="Redo stroke"
                          onClick={handleRedo}
                          disabled={historyIndex >= historyStack.length - 1}
                          className="editor-tool-btn"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 7v6h-6"/>
                            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                          </svg>
                        </button>

                        <div className="editor-toolbar-divider" />

                        {/* Cancel Button */}
                        <button
                          type="button"
                          title="Cancel changes"
                          onClick={handleCancel}
                          className="editor-tool-btn editor-tool-btn--danger"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>

                        {/* Save Button */}
                        <button
                          type="button"
                          title="Save changes"
                          onClick={handleSave}
                          className="editor-tool-btn editor-tool-btn--success"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Standard Mode Header */
                    <>
                      <span>Result</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {resCanvasState && ["background-removal", "object-segmentation"].includes(currentService.id) && (
                          <button
                            type="button"
                            title="Touch up result manually"
                            onClick={startTouchupMode}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-muted)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all var(--transition-fast)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                              e.currentTarget.style.color = 'var(--text-main)';
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                              e.currentTarget.style.color = 'var(--text-muted)';
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"/>
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                            </svg>
                            Touchup
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="preview-image-wrapper">
                  {currentService.id !== "captioning" && <MaskEditorOverlay resRef={resRef} />}
                  {!resCanvas && !isProcessing && (
                    <div className="result-placeholder">
                      Waiting for processing...
                    </div>
                  )}
                  <>
                    {currentService.id === "captioning" && resCanvas && (
                      <div className="caption-result-container">
                        <textarea
                          className="caption-textarea"
                          value={resCanvas.dataset?.caption || ""}
                          readOnly
                        />
                        <button
                          type="button"
                          className="btn-copy-caption"
                          onClick={(e) => {
                            navigator.clipboard.writeText(resCanvas.dataset?.caption || "");
                            const btn = e.currentTarget;
                            btn.classList.add("copied");
                            const originalHTML = btn.innerHTML;
                            btn.textContent = "Copied!";
                            setTimeout(() => {
                              btn.classList.remove("copied");
                              btn.innerHTML = originalHTML;
                            }, 2000);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                          Copy Caption
                        </button>
                      </div>
                    )}
                    <canvas
                      ref={resRef}
                      className={(!resCanvas || currentService.id === "captioning") ? "hidden" : ""}
                    ></canvas>
                  </>
                </div>
                {resCanvasState && !isProcessing && (
                  <div className="preview-panel-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', borderTop: '1px solid rgba(255, 255, 255, 0.04)', background: 'rgba(0, 0, 0, 0.15)' }}>
                    <Button
                      variant="primary"
                      size="tiny"
                      onClick={() => {
                        const { filename, mimeType } = getDownloadMetadata(
                          null,
                          currentService.id,
                          resCanvasState,
                        );
                        downloadCanvas(resCanvasState, filename, mimeType);
                      }}
                      icon={
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      }
                    >
                      Download Image
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {currentService.id === "object-segmentation" && <SegmentationCandidates />}

      {!isMultiMode && srcCanvas && currentService.id !== "image-editor" && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0', width: '100%' }}>
          <Button variant="secondary" onClick={handleReset} style={{ padding: "6px 16px", fontSize: "13px" }}>
            New Image
          </Button>

          <Button
            variant={isProcessing ? "secondary" : "primary"}
            onClick={isProcessing ? batch.cancel : getProcessAction()}
            style={{ padding: "6px 16px", fontSize: "13px" }}
            disabled={isGeneratingMask}
          >
            {isProcessing ? "Pause" : getProcessLabel()}
          </Button>
        </div>
      )}

      {!isMultiMode && srcCanvas && currentService.id === "image-editor" && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '12px 0', width: '100%' }}>
          <Button variant="secondary" onClick={handleReset} style={{ padding: "6px 16px", fontSize: "13px" }}>
            New Image
          </Button>
        </div>
      )}

      {isMultiMode && (
        <div className="actions actions-row" style={{ marginTop: '20px' }}>
          <Button
            variant="primary"
            onClick={batch.downloadSelected}
            disabled={batch.selectedIds.size === 0}
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            }
          >
            Download Selected ({batch.selectedIds.size})
          </Button>
          <Button
            variant="primary"
            onClick={batch.downloadAll}
            disabled={batch.doneCount === 0}
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            }
          >
            Download All
          </Button>
        </div>
      )}
    </div>
  );
};

export default Workspace;
