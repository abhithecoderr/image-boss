import { useNavigate } from 'react-router-dom';
import { useApp } from "../../context/AppContext";
import { SERVICE_ORDER } from "../../config/app";
import { SERVICES } from "../../config/services";

const Sidebar = () => {
  const { currentService } = useApp();
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
              className={`nav-item ${currentService.id === id ? 'active' : ''}`}
              onClick={() => navigate(`/services/${id}`)}
            >
              <span className="icon">{service.icon}</span>
              <span className="label">{service.name}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
