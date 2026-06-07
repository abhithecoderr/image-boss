import React from "react";
import { useNavigate } from "react-router-dom";
import { useService } from "../../store";
import { SERVICE_ORDER } from "../../config/app";
import { SERVICES } from "../../config/services";
import ServiceIcon from "../ui/ServiceIcon";

const Sidebar = () => {
  const { currentService } = useService();
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
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
              <span className="icon">
                <ServiceIcon id={id} />
              </span>
              <span className="label">{service.name}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
