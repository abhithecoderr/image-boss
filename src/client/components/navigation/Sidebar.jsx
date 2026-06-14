import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useService, useWorkspace } from "../../store";
import { SERVICE_ORDER } from "../../config/app";
import { SERVICES } from "../../config/services";
import ServiceIcon from "../ui/ServiceIcon";
import ConfirmModal from "../ui/ConfirmModal";

const Sidebar = ({ isOpen = false, onClose }) => {
  const { currentService } = useService();
  const hasResult = useWorkspace(
    (state) => !!state.items.find((i) => i.id === state.activeItemId)?.resultCanvas,
  );
  const isProcessing = useWorkspace((state) => state.isProcessing);
  const navigate = useNavigate();

  const [pendingService, setPendingService] = useState(null);

  const handleNavigate = (id) => {
    // Same service — no warning needed.
    if (id === currentService.id) return;

    // Only warn if the service is currently processing.
    if (isProcessing) {
      setPendingService({ id, name: SERVICES[id]?.name || id });
      return;
    }

    navigate(`/services/${id}`);
    if (onClose) onClose();
  };

  const confirmSwitch = () => {
    if (pendingService) {
      navigate(`/services/${pendingService.id}`);
    }
    setPendingService(null);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Backdrop for the mobile drawer. Clicking it closes the sidebar. */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar${isOpen ? " is-open" : ""}`}>
        <nav className="nav-services">
          {SERVICE_ORDER.map((id) => {
            const service = SERVICES[id];
            if (service.disabled) return null;

            return (
              <button
                type="button"
                key={id}
                className={`nav-item ${currentService.id === id ? "active" : ""}`}
                onClick={() => handleNavigate(id)}
                title={service.name}
              >
                <span className="icon">
                  <ServiceIcon id={id} />
                </span>
                <span className="label">{service.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <ConfirmModal
        isOpen={!!pendingService}
        onClose={() => setPendingService(null)}
        onConfirm={confirmSwitch}
        title="Switch service?"
        message={
          pendingService
            ? `Switching to ${pendingService.name} will discard the current result. Continue?`
            : ""
        }
        confirmText={`Switch to ${pendingService?.name || ""}`}
        cancelText="Stay"
        isDanger
      />
    </>
  );
};

export default Sidebar;
