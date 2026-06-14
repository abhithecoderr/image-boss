import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Logo from "../ui/Logo";
import { useAuth } from "../../store";
import { SERVICES, SERVICE_ORDER, SOLUTIONS, SOLUTIONS_ORDER } from "../../config";
import NavDropdown from "./NavDropdown";
import ConfirmModal from "../ui/ConfirmModal";
import { UserIcon, LogOutIcon } from "../ui/Icons";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const Navbar = ({ minimal = false, onToggleSidebar }) => {
  const { user, logout, isAuthenticated } = useAuth();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dropdownRef = useRef(null);

  // Secondary nav links (Product/Solutions/Pricing/About) are hidden on phones;
  // the app-sidebar hamburger only appears in the minimal (app) shell.
  const isMobile = useMediaQuery("(max-width: 991px)");

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

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
        {minimal && isMobile && (
          <button
            type="button"
            className="navbar-hamburger"
            onClick={onToggleSidebar}
            aria-label="Open services menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        <Logo />

        {/* Marketing nav links — hidden on phones (mobile decision: keep only auth actions). */}
        {!minimal && !isAuthenticated && !isMobile && (
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
              <Link to="/services" className="navbar-link navbar-dashboard-link">
                Dashboard
              </Link>
              <div className="navbar-right-group">
                {/* Credits Indicator */}
                <div
                  className="navbar-credits"
                  title="Your remaining processing credits"
                >
                  <svg
                    className="navbar-credits-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="8"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  <span>{typeof user?.credits === 'number' ? user.credits : 100} Cr</span>
                </div>

                {/* Profile Dropdown Container */}
                <div ref={dropdownRef} className="profile-menu-container">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="profile-avatar-btn"
                  >
                    {user?.initials || "US"}
                  </button>

                  {isDropdownOpen && (
                    <div className="profile-dropdown">
                      <div className="dropdown-header">
                        <span className="dropdown-name">{user?.name || "Member"}</span>
                        <span className="dropdown-email">{user?.email}</span>
                      </div>
                      <div className="dropdown-divider"></div>
                      <Link
                        to="/profile"
                        className="dropdown-item"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <UserIcon size={14} /> My Profile
                      </Link>
                      <button
                        type="button"
                        className="dropdown-item logout-btn"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setShowLogoutConfirm(true);
                        }}
                      >
                        <LogOutIcon size={14} /> Log Out
                      </button>
                    </div>
                  )}
                </div>
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
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
        }}
        title="Confirm Log Out"
        message="Are you sure you want to log out of your Image Boss account?"
        confirmText="Log Out"
        isDanger
      />
    </nav>
  );
};

export default Navbar;
