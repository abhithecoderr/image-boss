import React from "react";
import { useNavigate } from "react-router-dom";
import { useService } from "../../store";
import { SERVICE_ORDER } from "../../config/app";
import { SERVICES } from "../../config/services";
import ServiceIcon from "../ui/ServiceIcon";

const Sidebar = ({ isOpen = false, onClose }) => {
  const { currentService } = useService();
  const navigate = useNavigate();

  const handleNavigate = (id) => {
    navigate(`/services/${id}`);
    // Close the mobile drawer after navigating (no-op on desktop).
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
    </>
  );
};

export default Sidebar;
