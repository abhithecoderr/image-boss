import React, { useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useFileIngestion } from "../../hooks/useFileIngestion";
import SAMOverlay from "../workspace/overlays/SAMOverlay";
import SegmentationCandidates from "../SegmentationCandidates";
import ComparisonSlider from "../workspace/ComparisonSlider";
import MaskEditorOverlay from "../workspace/overlays/MaskEditorOverlay";
import MagicEraseOverlay from "../workspace/overlays/MagicEraseOverlay";
import EditorPreview from "../EditorPreview";
import BatchStrip from "../workspace/BatchStrip";
import { downloadCanvas } from "../../core/canvas-utils";

const Workspace = ({ batch }) => {
  const {
    currentService,
    getDownloadMetadata,
    progress,
    originalCanvas: srcCanvasState,
    resultCanvas: resCanvasState,
    isProcessing,
  } = useApp();

  const { handleFile } = useFileIngestion();
  const srcRef = useRef(null);
  const resRef = useRef(null);

  const isBatchView = batch.mode === 'batch';

  // Sync state canvases to DOM canvases
  useEffect(() => {
    if (srcCanvasState && srcRef.current) {
      const ctx = srcRef.current.getContext("2d");
      srcRef.current.width = srcCanvasState.width;
      srcRef.current.height = srcCanvasState.height;
      ctx.drawImage(srcCanvasState, 0, 0);
    }
  }, [srcCanvasState]);

  useEffect(() => {
    if (!resRef.current) return;
    const ctx = resRef.current.getContext("2d");

    if (resCanvasState) {
      resRef.current.width = resCanvasState.width;
      resRef.current.height = resCanvasState.height;

      const isValidSource =
        resCanvasState instanceof HTMLCanvasElement ||
        resCanvasState instanceof OffscreenCanvas ||
        resCanvasState instanceof ImageBitmap;

      if (isValidSource) {
        ctx.drawImage(resCanvasState, 0, 0);
      }
    } else {
      // Clear canvas if no result
      ctx.clearRect(0, 0, resRef.current.width, resRef.current.height);
    }
  }, [resCanvasState]);

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

  const showUploadArea = !srcCanvasState && (!isBatchView || batch.items.length === 0);

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
      {isProcessing && (
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
      )}

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
                batch.clearMemory();
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
              {!resCanvasState && !isProcessing && (
                <div className="result-placeholder">
                  Waiting for processing...
                </div>
              )}
              <canvas
                ref={resRef}
                className={!resCanvasState ? "hidden" : ""}
              ></canvas>
            </div>
          </div>
        )}
      </div>

      <SegmentationCandidates />
    </div>
  );
};

export default Workspace;

