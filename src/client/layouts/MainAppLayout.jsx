/*
 * Main dashboard layout for authenticated users, synchronizing service states with route URL parameters.
 */
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useService, useUI, useWorkspace, useServiceStore } from "../store";
import { useUnifiedProcessor as useController } from "../hooks/useUnifiedProcessor";
import { SERVICES } from "../config/services";
import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/navigation/Sidebar";
import Workspace from "../components/workspace/Workspace";
import ControlPanel from "../components/controls/ControlPanel";
import WorkflowBuilder from "../components/workspace/WorkflowBuilder";
import { OPERATION_MODE } from "../config/app";
import ErrorBoundary from "../components/ui/ErrorBoundary";
import Navbar from "../components/navigation/Navbar";
import Footer from "../components/navigation/Footer";

export default function MainAppLayout() {
  const { serviceId } = useParams();
  const setActiveServiceId = useServiceStore((state) => state.setActiveServiceId);

  // Owns the mobile sidebar drawer state so it survives Navbar re-renders.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync active service parameter from router to global Zustand store
  useEffect(() => {
    if (serviceId) {
      setActiveServiceId(serviceId);
    }
  }, [serviceId, setActiveServiceId]);

  const { currentService, serviceSettings } = useService();
  const toast = useUI((state) => state.toast);
  const { originalCanvas } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const processor = useController();
  const { execute, mode } = processor;

  const autoProcessedRef = useRef(false);

  // Auto-close the mobile sidebar drawer whenever the active service changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [serviceId]);

  // Triggers immediate automatic execution if redirected from the homepage sandbox with autoProcess instructions
  useEffect(() => {
    if (location.state?.autoProcess && originalCanvas && currentService.id === serviceId && !autoProcessedRef.current) {
      autoProcessedRef.current = true;
      // Clear out the router state immediately to prevent repetitive triggers on render/refresh
      navigate(location.pathname, { replace: true, state: {} });

      execute(serviceSettings[serviceId] || {});
    }
  }, [location.state, originalCanvas, execute, serviceSettings, serviceId, currentService.id, navigate, location.pathname]);

  return (
    <div id="main-app-container">
      <Navbar minimal onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="main-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main id="main">
          <div className="service-info">
            <h1>{currentService.name}</h1>
            <p>{currentService.description}</p>
          </div>

          <>
            <ErrorBoundary>
              <Workspace />

              {mode === OPERATION_MODE.WORKFLOW && (
                <WorkflowBuilder workflow={processor} onProcess={execute} />
              )}

              {mode !== OPERATION_MODE.WORKFLOW && <ControlPanel />}
            </ErrorBoundary>

          </>
        </main>
      </div>

      <Footer />

      {toast && (
        <div className={`toast show toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
}
