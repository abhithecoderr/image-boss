import React, { useState } from "react";
import { Link } from "react-router-dom";
import ServiceIcon from "../ui/ServiceIcon";

/**
 * NavDropdown
 * A reusable component to render hover megamenu dropdown grids in the navbar.
 */
export default function NavDropdown({
  triggerText,
  triggerLink,
  headerTitle,
  headerDesc,
  items = [],
  viewAllLink,
  viewAllText,
  dropdownClass = "",
  gridClass = ""
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div
      className={`nav-dropdown-wrapper ${isOpen ? "is-open" : ""}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Link to={triggerLink} className="navbar-link dropdown-trigger" onClick={handleClose}>
        {triggerText} <span className="dropdown-caret">▾</span>
      </Link>
      <div className={`nav-dropdown-menu ${dropdownClass}`}>
        {headerTitle && (
          <div className="nav-dropdown-header">
            <h3>{headerTitle}</h3>
            {headerDesc && <p>{headerDesc}</p>}
          </div>
        )}
        
        {items.length > 0 && (
          <div className={`nav-dropdown-grid ${gridClass}`}>
            {items.map((item) => (
              <Link key={item.id} to={item.link} className="nav-dropdown-item" onClick={handleClose}>
                <div className="nav-dropdown-icon">
                  <ServiceIcon id={item.icon} />
                </div>
                <div className="nav-dropdown-info">
                  <div className="nav-dropdown-name">{item.name}</div>
                  <div className="nav-dropdown-desc">{item.description}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
        
        {viewAllLink && (
          <div className="nav-dropdown-footer">
            <Link to={viewAllLink} className="nav-dropdown-all-link" onClick={handleClose}>
              {viewAllText || "Explore All ➔"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
