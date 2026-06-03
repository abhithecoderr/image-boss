import React from "react";
import { useNavigate } from "react-router-dom";
import { useService } from "../../store";
import { SERVICE_ORDER } from "../../config/app";
import { SERVICES } from "../../config/services";
import ArrowButton from "../ui/ArrowButton";

const Sidebar = () => {
  const { currentService } = useService();
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo" title="Image Boss">
          <span className="brand-icon">🚀</span>
        </div>
        <ArrowButton
          direction="left"
          onClick={() => navigate("/")}
          label="Back to Home"
          className="sidebar-back-btn"
        />
      </div>

      <nav className="nav-services">
        {SERVICE_ORDER.map((id) => {
          const service = SERVICES[id];
          if (service.disabled) return null;

          return (
            <button
              key={id}
              className={`nav-item ${currentService.id === id ? "active" : ""}`}
              onClick={() => navigate(`/services/${id}`)}
              title={service.name}
            >
              <span className="icon">{service.icon}</span>
              <span className="label">{service.name}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
