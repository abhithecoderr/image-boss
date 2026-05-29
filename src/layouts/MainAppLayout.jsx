import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useService, useUI, useWorkspace } from "../context/AppContext";
import { SERVICES } from "../config/services";
import React, { useEffect, useMemo } from "react";
import Sidebar from "../components/navigation/Sidebar";
import Workspace from "../components/workspace/Workspace";
import ControlPanel from "../components/controls/ControlPanel";
import WorkflowBuilder from "../components/workflow/WorkflowBuilder";
import { OPERATION_MODE } from "../config/app";
import { useUnifiedProcessor } from "../hooks/useUnifiedProcessor";
import ErrorBoundary from "../components/ui/ErrorBoundary";

export default function MainAppLayout() {
  const { currentService, serviceSettings } = useService();
  const { toast } = useUI();
  const { originalCanvas } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const { execute, engine, mode, unified } = useUnifiedProcessor();

  // Triggers immediate automatic execution if redirected from the homepage sandbox with autoProcess instructions
  useEffect(() => {
    if (location.state?.autoProcess && originalCanvas) {
      // Clear out the router state immediately to prevent repetitive triggers on render/refresh
      navigate(location.pathname, { replace: true, state: {} });

      execute(serviceSettings[currentService.id] || {});
    }
  }, [location.state, originalCanvas, execute, serviceSettings, currentService.id, navigate, location.pathname]);

  const handleProcess = (options, itemsOverride = null) =>
    execute(options, itemsOverride);

  return (
    <div id="main-app-container">
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
                <WorkflowBuilder workflow={unified} onProcess={handleProcess} />
              )}

              <Workspace
                batch={useMemo(
                  () =>
                    mode === OPERATION_MODE.WORKFLOW
                      ? { ...engine, mode: "batch" }
                      : engine,
                  [mode, engine],
                )}
              />

              {mode !== OPERATION_MODE.WORKFLOW && <ControlPanel />}
            </ErrorBoundary>

          </>
        </main>
      </div>

      {toast && (
        <div className={`toast show toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
}
