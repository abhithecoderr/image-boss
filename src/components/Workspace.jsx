import React, { useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useFileIngestion } from "../hooks/useFileIngestion";
import SAMOverlay from "./features/SAMOverlay";
import SegmentationCandidates from "./features/SegmentationCandidates";
import ComparisonSlider from "./features/ComparisonSlider";
import MaskEditorOverlay from "./features/MaskEditorOverlay";
import MagicEraseOverlay from "./features/MagicEraseOverlay";
import { downloadCanvas } from "../core/canvas-utils";

const Workspace = () => {
  const {
    originalCanvas: srcCanvasState,
    resultCanvas: resCanvasState,
    isProcessing,
    progress,
    currentService,
  } = useApp();

  const { handleFile } = useFileIngestion();
  const srcRef = useRef(null);
  const resRef = useRef(null);

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
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFile(file);
    }
  };

  if (!srcCanvasState) {
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
          <div className="upload-hint">Supports PNG, JPG, WebP (Max 5MB)</div>
        </div>
        <input
          type="file"
          id="file-input"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files[0])}
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
          <div className="preview-image-wrapper">
            <SAMOverlay srcRef={srcRef} />
            <MagicEraseOverlay srcRef={srcRef} />
            <canvas ref={srcRef}></canvas>
          </div>
        </div>

        {currentService.id === "upscaling" && resCanvasState ? (
          <div className="preview-panel">
            <div className="preview-label preview-header">
              <span>Comparison</span>
              <button
                className="btn btn-secondary btn-tiny"
                onClick={() => {
                  const filename = `upscaled_${Date.now()}.png`;
                  downloadCanvas(resCanvasState, filename);
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
                    const filename = `processed_${Date.now()}.png`;
                    downloadCanvas(resCanvasState, filename);
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
