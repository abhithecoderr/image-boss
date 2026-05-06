import { useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { SERVICES } from "../../config/services";
import React, { useEffect } from "react";
import Sidebar from "./Sidebar";
import Workspace from "./Workspace";
import ControlPanel from "./ControlPanel";
import WorkflowBuilder from "../WorkflowBuilder";
import { OPERATION_MODE } from "../../config/app";
import { useAppEngine } from "../../hooks/useAppEngine";

export default function MainAppLayout() {
  const { serviceId } = useParams();
  const { 
    currentService, 
    selectService,
    toast, 
    resetWorkspace, 
    resultCanvas, 
    getDownloadMetadata 
  } = useApp();
  
  // Sync URL to Service Context
  useEffect(() => {
    if (serviceId && SERVICES[serviceId] && serviceId !== currentService.id) {
      selectService(serviceId);
    }
  }, [serviceId, currentService.id, selectService]);

  const { execute, reset, engine, mode } = useAppEngine();

  const handleProcess = (options) => execute(options);
  const handleReset = () => {
    reset();
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
            {mode === OPERATION_MODE.WORKFLOW && (
              <WorkflowBuilder
                workflow={engine}
                onProcess={handleProcess}
              />
            )}

            <Workspace
              batch={
                mode === OPERATION_MODE.WORKFLOW 
                  ? { ...engine, mode: "batch" } 
                  : engine
              }
            />

            {mode !== OPERATION_MODE.WORKFLOW && (
              <ControlPanel />
            )}

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
                      import("../../core/canvas-utils").then((m) =>
                        m.downloadCanvas(resultCanvas, filename, mimeType),
                      );
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
