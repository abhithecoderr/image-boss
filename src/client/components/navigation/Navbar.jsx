import React from "react";
import { Link } from "react-router-dom";
import Logo from "../ui/Logo";
import { useAuth } from "../../store";
import { SERVICES, SERVICE_ORDER, SOLUTIONS, SOLUTIONS_ORDER } from "../../config";
import NavDropdown from "./NavDropdown";

const Navbar = ({ minimal = false }) => {
  const { user, logout, isAuthenticated } = useAuth();

  const activeServiceIds = SERVICE_ORDER.filter(id => !SERVICES[id]?.disabled);

  // Prepare product items for the dropdown
  const productItems = activeServiceIds.map((id) => ({
    id,
    name: SERVICES[id].name,
    description: SERVICES[id].description,
    icon: id,
    link: `/product/${id}`
  }));

  // Prepare solutions items for the dropdown
  const solutionItems = SOLUTIONS_ORDER.map((id) => ({
    id,
    name: SOLUTIONS[id].name,
    description: SOLUTIONS[id].description,
    icon: SOLUTIONS[id].icon,
    link: `/solutions/${id}`
  }));

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Logo />
        
        {!minimal && (
          <div className="navbar-links">
            <NavDropdown
              triggerText="Product"
              triggerLink="/product"
              headerTitle="AI Products & Services"
              headerDesc="State-of-the-art AI tools running locally in your browser."
              items={productItems}
              viewAllLink="/product"
              viewAllText="Explore All AI Tools ➔"
            />

            <NavDropdown
              triggerText="Solutions"
              triggerLink="/solutions"
              headerTitle="Industry Solutions"
              headerDesc="Tailored workflows optimized for specific industries and use cases."
              items={solutionItems}
              viewAllLink="/solutions"
              viewAllText="View All Use Cases ➔"
            />

            <Link to="/pricing" className="navbar-link">
              Pricing
            </Link>
            <Link to="/about" className="navbar-link">
              About
            </Link>
          </div>
        )}
        
        <div className="navbar-actions">
          {isAuthenticated ? (
            <>
              <Link to="/services" className="navbar-link" style={{ fontWeight: "500" }}>
                Dashboard
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div
                  title={user?.email}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "var(--accent-primary)",
                    color: "var(--text-inverse)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "600",
                    fontSize: "12px",
                    userSelect: "none",
                    boxShadow: "0 0 0 2px rgba(245, 166, 35, 0.2)"
                  }}
                >
                  {user?.initials || "US"}
                </div>
                <button
                  onClick={logout}
                  className="btn btn-secondary btn-tiny"
                  style={{ padding: "var(--space-1) var(--space-3)", borderRadius: "var(--radius-sm)" }}
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">
                Log In
              </Link>
              <Link to="/signup" className="navbar-cta">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
