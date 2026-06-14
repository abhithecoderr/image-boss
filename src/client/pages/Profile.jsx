import React, { useState } from "react";
import { useAuth } from "../store";
import { Link } from "react-router-dom";
import ConfirmModal from "../components/ui/ConfirmModal";
import {
  UserIcon,
  CreditCardIcon,
  SettingsIcon,
  KeyIcon,
  LockIcon,
  MonitorIcon,
} from "../components/ui/Icons";
import "../styles/05-pages/profile.css";

const Profile = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("personal"); // personal, plan, settings
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "May 30, 2026";

  const getHeaderInfo = () => {
    switch (activeTab) {
      case "personal":
        return {
          title: "Personal Information",
          subtitle: "Manage your profile name, contact email, and membership credentials."
        };
      case "plan":
        return {
          title: "Plan & Subscription",
          subtitle: "Review your current processing limits or upgrade to unlock cloud models."
        };
      case "settings":
        return {
          title: "Security Settings",
          subtitle: "Update your password, manage active browser sessions, and adjust credentials."
        };
      default:
        return {
          title: "Account Settings",
          subtitle: "Manage your profile details, subscription, and preferences."
        };
    }
  };

  const { title, subtitle } = getHeaderInfo();

  return (
    <div className="profile-page-container animate-fade-in">
      <div className="profile-layout-wrapper">
        {/* Left Sidebar Menu */}
        <aside className="profile-sidebar-menu">
          <div className="profile-sidebar-header">
            <h2 className="profile-sidebar-title">Settings</h2>
          </div>
          <nav className="profile-sidebar-nav">
            <button
              type="button"
              className={`profile-tab-btn ${activeTab === "personal" ? "active" : ""}`}
              onClick={() => setActiveTab("personal")}
            >
              <UserIcon size={16} /> Personal Info
            </button>
            <button
              type="button"
              className={`profile-tab-btn ${activeTab === "plan" ? "active" : ""}`}
              onClick={() => setActiveTab("plan")}
            >
              <CreditCardIcon size={16} /> Plan Details
            </button>
            <button
              type="button"
              className={`profile-tab-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <SettingsIcon size={16} /> Security & Settings
            </button>
          </nav>
        </aside>

        {/* Right Content Pane */}
        <main className="profile-content-pane">
          <header className="profile-pane-header">
            <h1 className="profile-title">{title}</h1>
            <p className="profile-subtitle">{subtitle}</p>
          </header>

          <div className="profile-pane-content">
            {activeTab === "personal" && (
              <div className="settings-section animate-fade-in">
                {/* Profile Hero Row */}
                <div className="profile-hero-row">
                  <div className="profile-avatar-large">
                    {user?.initials || "US"}
                  </div>
                  <div className="profile-hero-details">
                    <h2 className="profile-hero-name">{user?.name || "Image Boss User"}</h2>
                    <p className="profile-hero-email">{user?.email}</p>
                  </div>
                </div>

                {/* Info Rows */}
                <div className="settings-rows-list">
                  <div className="settings-row">
                    <span className="settings-label">Full Name</span>
                    <span className="settings-value">{user?.name || "Image Boss User"}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Email Address</span>
                    <span className="settings-value">{user?.email}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Joined On</span>
                    <span className="settings-value">{joinedDate}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">User ID</span>
                    <span className="settings-value code-font">{user?.id || "ib_usr_8f3a2b10cd4e"}</span>
                  </div>
                  <div className="settings-row">
                    <span className="settings-label">Account Role</span>
                    <span className="settings-value text-accent">Member</span>
                  </div>
                </div>

                <div style={{ marginTop: "var(--space-8)" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowSignOutConfirm(true)}
                  >
                    Sign Out of Account
                  </button>
                </div>
              </div>
            )}

            {activeTab === "plan" && (
              <div className="settings-section animate-fade-in">
                <div className="settings-rows-list">
                  <div className="settings-row">
                    <span className="settings-label">Current Plan</span>
                    <div className="settings-value">
                      <span className="plan-badge-inline">Free Tier</span>
                    </div>
                  </div>
                  
                  <div className="settings-row align-start">
                    <span className="settings-label">Plan Features</span>
                    <div className="settings-value plan-features-list">
                      <ul>
                        <li>
                          <span className="feature-check">✓</span> 10 image processes per day
                        </li>
                        <li>
                          <span className="feature-check">✓</span> 100% private local browser-GPU processing
                        </li>
                        <li>
                          <span className="feature-check">✓</span> Standard background removal & upscaling models
                        </li>
                        <li>
                          <span className="feature-check">✓</span> Access to basic workspace tools
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4 className="settings-row-title">Upgrade Plan</h4>
                      <p className="settings-row-desc">Unlock unlimited processing, priority speeds, batch workflows, and Pro cloud models.</p>
                    </div>
                    <Link to="/pricing" className="btn btn-primary">
                      Upgrade to Pro
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="settings-section animate-fade-in">
                <div className="settings-rows-list">
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4 className="settings-row-title">
                        <KeyIcon size={15} /> Change Password
                      </h4>
                      <p className="settings-row-desc">Update the security password used to log in to your account.</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => alert("Password reset link has been mock-sent to: " + user?.email)}
                    >
                      Change Password
                    </button>
                  </div>
                  
                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4 className="settings-row-title">
                        <LockIcon size={15} /> Two-Factor Authentication
                      </h4>
                      <p className="settings-row-desc">Protect your account with an extra verification code on signing in.</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => alert("Mock MFA enrollment initiated.")}
                    >
                      Configure 2FA
                    </button>
                  </div>

                  <div className="settings-row">
                    <div className="settings-row-info">
                      <h4 className="settings-row-title">
                        <MonitorIcon size={15} /> Active Devices
                      </h4>
                      <p className="settings-row-desc">Sign out of active sessions on other computers, browsers, or locations.</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => alert("Session credentials cleared.")}
                    >
                      Sign Out Other Devices
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <ConfirmModal
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={() => {
          setShowSignOutConfirm(false);
          logout();
        }}
        title="Confirm Sign Out"
        message="Are you sure you want to sign out of your Image Boss account?"
        confirmText="Sign Out"
        isDanger
      />
    </div>
  );
};

export default Profile;
