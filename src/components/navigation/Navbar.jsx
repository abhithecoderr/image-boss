import React from "react";
import { Link } from "react-router-dom";
import Logo from "../ui/Logo";
import { useAuth } from "../../context/AppContext";

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Logo />
        
        <div className="navbar-links">
          <Link to="/features" className="navbar-link">
            Features
          </Link>
          <Link to="/pricing" className="navbar-link">
            Pricing
          </Link>
          <Link to="/about" className="navbar-link">
            About
          </Link>
        </div>
        
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

export default React.memo(Navbar);
