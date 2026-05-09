import { useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { SERVICES } from "../../config/services";
import React, { useEffect, useMemo } from "react";
import Sidebar from "./Sidebar";
import Workspace from "./Workspace";
import ControlPanel from "./ControlPanel";
import WorkflowBuilder from "../WorkflowBuilder";
import { OPERATION_MODE } from "../../config/app";
import { useAppEngine } from "../../hooks/useAppEngine";
import { downloadCanvas } from "../../core/canvas-utils";
import ErrorBoundary from "../ErrorBoundary";

export default function MainAppLayout() {
  const {
    currentService,
    toast,
    resetWorkspace,
    resultCanvas,
    getDownloadMetadata
  } = useApp();


  const { execute, engine, mode, unified } = useAppEngine();

  const handleProcess = (options, itemsOverride = null) => execute(options, itemsOverride);
  const handleReset = () => {
    resetWorkspace();
  };

  return (
    <div id="main-app-container">
      <header id="nav">
        <div className="nav-brand">
          <span className="brand-icon">🚀</span>
          <span className="brand-text">Image Boss</span>
        </div>
      </header>

      <div className="main-layout">
        <Sidebar />

        <main id="main">
          <div className="service-info">
            <h1>{currentService.name}</h1>
            <p>{currentService.description}</p>
          </div>

          <>
            <ErrorBoundary>
              {mode === OPERATION_MODE.WORKFLOW && (
                <WorkflowBuilder
                  workflow={unified}
                  onProcess={handleProcess}
                />
              )}

              <Workspace
                batch={useMemo(() => (
                  mode === OPERATION_MODE.WORKFLOW
                    ? { ...engine, mode: "batch" }
                    : engine
                ), [mode, engine])}
              />

              {mode !== OPERATION_MODE.WORKFLOW && (
                <ControlPanel />
              )}
            </ErrorBoundary>

            <div className="actions actions-row">
              <button
                className="btn btn-secondary"
                onClick={handleReset}
              >
                New Image
              </button>

              {mode !== OPERATION_MODE.SINGLE ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={engine.downloadSelected}
                    disabled={engine.selectedIds.size === 0}
                  >
                    📥 Download Selected (
                    {engine.selectedIds.size})
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={engine.downloadAll}
                    disabled={engine.doneCount === 0}
                  >
                    📥 Download All
                  </button>
                </>
              ) : (
                resultCanvas && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const { filename, mimeType } = getDownloadMetadata(null, currentService.id, resultCanvas);
                      downloadCanvas(resultCanvas, filename, mimeType);
                    }}
                  >
                    📥 Download Result
                  </button>
                )
              )}
            </div>
          </>
        </main>
      </div>

      {toast && (
        <div className={`toast show toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
