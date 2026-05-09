import React, { useRef, useEffect } from "react";
import { useUI, useWorkspace, useService } from "../../context/AppContext";
import { useFileIngestion } from "../../hooks/useFileIngestion";
import SAMOverlay from "../workspace/overlays/SAMOverlay";
import SegmentationCandidates from "../SegmentationCandidates";
import ComparisonSlider from "../workspace/ComparisonSlider";
import MaskEditorOverlay from "../workspace/overlays/MaskEditorOverlay";
import MagicEraseOverlay from "../workspace/overlays/MagicEraseOverlay";
import EditorPreview from "../EditorPreview";
import BatchStrip from "../workspace/BatchStrip";
import { downloadCanvas } from "../../core/canvas-utils";

const StatusBar = React.memo(() => {
  const { progress } = useUI();
  const { isProcessing } = useWorkspace();
  if (!isProcessing) return null;
  return (
    <div className="status-bar">
      <div className="progress-container">
        <div
          className="progress-fill"
          style={{ width: `${progress.percent * 100}%` }}
        ></div>
      </div>
      <div className="progress-text">
        {progress.message || "Processing..."}
      </div>
    </div>
  );
});

const Workspace = ({ batch }) => {
  const { currentService, getDownloadMetadata } = useService();
  const {
    originalCanvas: srcCanvasState,
    resultCanvas: resCanvasState,
    isProcessing,
  } = useWorkspace();

  const { handleFile } = useFileIngestion();
  const srcRef = useRef(null);
  const resRef = useRef(null);

  const isBatchView = batch.mode === 'batch';
  const isWorkflowView = batch.mode === 'workflow';
  const isMultiMode = isBatchView || isWorkflowView;

  const activeItem = batch.items.find(i => i.id === batch.activeItemId);
  const srcCanvas = activeItem ? activeItem.sourceCanvas : srcCanvasState;
  
  // Prioritize the resCanvasState (from useWorkspace) as it may contain 
  // live edits or specific step previews. Fall back to the item's result.
  const resCanvas = resCanvasState || (activeItem ? activeItem.resultCanvas : null);

  // Sync state canvases to DOM canvases
  useEffect(() => {
    if (srcCanvas && srcRef.current) {
      const ctx = srcRef.current.getContext("2d");
      srcRef.current.width = srcCanvas.width;
      srcRef.current.height = srcCanvas.height;
      ctx.drawImage(srcCanvas, 0, 0);
    }
  }, [srcCanvas]);

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
  }, [resCanvas]);

  const onDrop = (e) => {
    e.preventDefault();
    if (isBatchView) {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        batch.addFiles(files);
      }
    } else {
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        handleFile(file);
      }
    }
  };

  const showUploadArea = !srcCanvas && (!isMultiMode || batch.items.length === 0);

  if (showUploadArea) {
    return (
      <div
        className="upload-area"
        onClick={() => document.getElementById("file-input").click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="upload-content">
          <div className="upload-icon">📁</div>
          <h2>Drop your image here</h2>
          <p>or click to browse</p>
          <div className="upload-hint">Supports PNG, JPG, WebP, AVIF, BMP, GIF, TIFF, ICO (Max 5MB)</div>
        </div>
        <input
          type="file"
          id="file-input"
          accept="image/png,image/jpeg,image/webp,image/avif,image/bmp,image/gif,image/tiff,image/x-icon,image/x-portable-anymap"
          multiple={isBatchView}
          hidden
          onChange={(e) => {
            if (isBatchView) {
              batch.addFiles(e.target.files);
            } else {
              handleFile(e.target.files[0]);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="workspace">
      <StatusBar />

      <div className="preview-container">
        <div className="preview-panel">
          <div className="preview-label">Original</div>

          {isBatchView && batch.items.length > 0 && (
            <BatchStrip
              items={batch.items}
              activeItemId={batch.activeItemId}
              selectedIds={batch.selectedIds}
              onSelectItem={batch.selectItem}
              onToggleSelect={batch.toggleItemSelection}
              onReorder={batch.reorderItems}
              onRemove={batch.removeItem}
              onAddFiles={batch.addFiles}
              onClearMemory={() => {
                // Send global dispose to all AI workers to free GPU memory
                import("../../core/worker-registry").then(({ workerRegistry }) => {
                  workerRegistry.activate(""); // switches to 'null' service, evicting all others
                });
              }}
            />
          )}

          <div
            className="preview-image-wrapper"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
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
        ) : currentService.id === "upscaling" && resCanvasState ? (
          <div className="preview-panel">
            <div className="preview-label preview-header">
              <span>Comparison</span>
              <button
                className="btn btn-secondary btn-tiny"
                onClick={() => {
                  const { filename, mimeType } = getDownloadMetadata(null, null, resCanvasState);
                  downloadCanvas(resCanvasState, filename, mimeType);
                }}
              >
                📥 Download
              </button>
            </div>
            <div className="preview-image-wrapper">
              <ComparisonSlider />
            </div>
          </div>
        ) : (
          <div className="preview-panel">
            <div className="preview-label preview-header">
              <span>Result</span>
              {resCanvasState && (
                <button
                  className="btn btn-secondary btn-tiny"
                  onClick={() => {
                    const { filename, mimeType } = getDownloadMetadata(null, null, resCanvasState);
                    downloadCanvas(resCanvasState, filename, mimeType);
                  }}
                >
                  📥 Download
                </button>
              )}
            </div>
            <div className="preview-image-wrapper">
              <MaskEditorOverlay resRef={resRef} />
              {!resCanvas && !isProcessing && (
                <div className="result-placeholder">
                  Waiting for processing...
                </div>
              )}
              <canvas
                ref={resRef}
                className={!resCanvas ? "hidden" : ""}
              ></canvas>
            </div>
          </div>
        )}
      </div>

      <SegmentationCandidates />
    </div>
  );
};

export default React.memo(Workspace);

