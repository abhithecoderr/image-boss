import React, { useRef, useEffect } from "react";
import { useUI, useWorkspace, useService } from "../../context/AppContext";
import { useFileUpload } from "../../hooks/useFileUpload";
import SAMOverlay from "./overlays/SAMOverlay";
import SegmentationCandidates from "./SegmentationCandidates";
import ComparisonSlider from "./ComparisonSlider";
import MaskEditorOverlay from "./overlays/MaskEditorOverlay";
import MagicEraseOverlay from "./overlays/MagicEraseOverlay";
import EditorPreview from "./EditorPreview";
import BatchStrip from "./BatchStrip";
import { downloadCanvas } from "../../core/canvas-utils";
import Progress from "../ui/Progress";
import UploadZone from "../ui/UploadZone";
import Button from "../ui/Button";

const StatusBar = React.memo(() => {
  const { progress } = useUI();
  const { isProcessing } = useWorkspace();
  if (!isProcessing) return null;
  return (
    <Progress
      percent={progress.percent}
      message={progress.message || "Processing..."}
    />
  );
});

const Workspace = ({ batch }) => {
  const { currentService, getDownloadMetadata } = useService();
  const {
    originalCanvas: srcCanvasState,
    resultCanvas: resCanvasState,
    isProcessing,
    resetImages,
  } = useWorkspace();

  const { handleFile } = useFileUpload();
  const srcRef = useRef(null);
  const resRef = useRef(null);

  const isBatchView = batch.mode === "batch";
  const isWorkflowView = batch.mode === "workflow";
  const isMultiMode = isBatchView || isWorkflowView;

  const activeItem = batch.items.find((i) => i.id === batch.activeItemId);
  const srcCanvas = activeItem ? activeItem.sourceCanvas : srcCanvasState;

  // Prioritize the resCanvasState (from useWorkspace) as it may contain
  // live edits or specific step previews. Fall back to the item's result.
  const resCanvas =
    resCanvasState || (activeItem ? activeItem.resultCanvas : null);

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
                import("../../core/worker-registry").then(
                  ({ workerRegistry }) => {
                    workerRegistry.activate(""); // switches to 'null' service, evicting all others
                  },
                );
              }}
            />
          )}

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
        ) : currentService.id === "upscaling" && resCanvasState ? (
          <div className="preview-panel">
            <div className="preview-label preview-header">
              <span>Comparison</span>
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
              <ComparisonSlider />
            </div>
          </div>
        ) : (
          <div className="preview-panel">
            <div className="preview-label preview-header">
              <span>Result</span>
              {resCanvasState && (
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

      <div className="actions actions-row">
        <Button variant="secondary" onClick={resetImages}>
          New Image
        </Button>

        {isMultiMode ? (
          <>
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
          </>
        ) : (
          resCanvasState && (
            <Button
              variant="primary"
              onClick={() => {
                const { filename, mimeType } = getDownloadMetadata(
                  null,
                  currentService.id,
                  resCanvasState,
                );
                downloadCanvas(resCanvasState, filename, mimeType);
              }}
              icon={
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              }
            >
              Download Result
            </Button>
          )
        )}
      </div>
    </div>
  );
};

export default React.memo(Workspace);
