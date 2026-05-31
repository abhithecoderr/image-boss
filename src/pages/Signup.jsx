import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AppContext";
import FormInput from "../components/ui/FormInput";

const SignUp = () => {
  const { signup, isAuthenticated, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Input states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Strength and Validation states
  const [strength, setStrength] = useState({ score: 0, label: "", class: "" });
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [termsError, setTermsError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/services", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Live password strength calculation
  useEffect(() => {
    if (!password) {
      setStrength({ score: 0, label: "", class: "" });
      return;
    }

    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    let label = "Very Weak";
    let className = "weak";

    if (score >= 4) {
      label = "Strong";
      className = "strong";
    } else if (score >= 2) {
      label = "Medium";
      className = "medium";
    }

    setStrength({ score, label, class: className });
  }, [password]);

  // Form Validation
  const validateForm = () => {
    let isValid = true;
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setTermsError("");

    if (!name.trim()) {
      setNameError("Full name is required.");
      isValid = false;
    }

    if (!email) {
      setEmailError("Email address is required.");
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email address.");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      isValid = false;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      isValid = false;
    }

    if (!termsAccepted) {
      setTermsError("You must agree to the Terms of Service.");
      isValid = false;
    }

    return isValid;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    // Simulate standard network latency for premium feel (active spinner)
    setTimeout(async () => {
      const result = await signup(name, email, password);
      setIsSubmitting(false);

      if (result.success) {
        navigate("/services", { replace: true });
      }
    }, 1000);
  };

  return (
    <div className="auth-container">
      <div className="auth-split">
        {/* Left Side: Premium Local AI Showcase */}
        <section className="auth-visual-side">
          <div className="auth-glow-sphere-1"></div>
          <div className="auth-glow-sphere-2"></div>
          
          <header className="auth-visual-header">
            <Link to="/" className="navbar-logo" style={{ fontSize: "1.25rem" }}>
              <span className="logo-icon">⚡</span>
              <span className="logo-text">IMAGE BOSS</span>
            </Link>
          </header>

          <div className="auth-visual-body">
            <h1 className="auth-visual-title">
              Start Creating<br />
              <span>Beautiful Assets</span>
            </h1>
            <p className="auth-visual-description">
              Join thousands of creators using local browser-based models to transform assets instantly. Completely private.
            </p>

            <div className="auth-feature-cards">
              <div className="auth-feature-card animate-slide-up" style={{ animationDelay: "100ms" }}>
                <span className="auth-feature-card-icon">⚡</span>
                <div>
                  <h4 className="auth-feature-card-title">100% Web Local</h4>
                  <p className="auth-feature-card-desc">No queues, no high subscription fees. Runs directly on your GPU.</p>
                </div>
              </div>

              <div className="auth-feature-card animate-slide-up" style={{ animationDelay: "200ms" }}>
                <span className="auth-feature-card-icon">🔒</span>
                <div>
                  <h4 className="auth-feature-card-title">Strict Privacy Safeguard</h4>
                  <p className="auth-feature-card-desc">Your images never leave your machine. Perfect for secure enterprise workflows.</p>
                </div>
              </div>

              <div className="auth-feature-card animate-slide-up" style={{ animationDelay: "300ms" }}>
                <span className="auth-feature-card-icon">🌀</span>
                <div>
                  <h4 className="auth-feature-card-title">Powerful Workflows</h4>
                  <p className="auth-feature-card-desc">Combine scaling, erasing, and art generation tasks into single clicks.</p>
                </div>
              </div>
            </div>
          </div>

          <footer className="auth-visual-footer">
            <p>© 2026 Image Boss Inc. Privacy First, Web-Local AI Toolkit.</p>
          </footer>
        </section>

        {/* Right Side: Sign Up Card Shell */}
        <main className="auth-form-side">
          <div className="auth-form-wrapper">
            <header className="auth-form-header">
              <h2 className="auth-form-title">Create account</h2>
              <p className="auth-form-subtitle">
                Already have an account? <Link to="/login">Sign in here</Link>
              </p>
            </header>

            <div className="auth-card">
              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {/* Full Name */}
                <FormInput
                  id="signup-name"
                  label="Full Name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={nameError}
                  disabled={isSubmitting}
                  required
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  }
                />

                {/* Email Input */}
                <FormInput
                  id="signup-email"
                  label="Email Address"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={emailError}
                  disabled={isSubmitting}
                  required
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  }
                />

                {/* Password Input */}
                <FormInput
                  id="signup-password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={passwordError}
                  disabled={isSubmitting}
                  required
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  }
                >
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </FormInput>

                {/* Password Strength Meter */}
                {password && (
                  <div className="auth-strength-meter">
                    <div className="auth-strength-bars">
                      <div className={`auth-strength-bar ${strength.score >= 1 ? strength.class : ""}`}></div>
                      <div className={`auth-strength-bar ${strength.score >= 3 ? strength.class : ""}`}></div>
                      <div className={`auth-strength-bar ${strength.score >= 5 ? strength.class : ""}`}></div>
                    </div>
                    <span className={`auth-strength-label`} style={{
                      color: strength.class === "strong" ? "var(--success)" : strength.class === "medium" ? "var(--warning)" : "var(--error)"
                    }}>
                      Password Strength: {strength.label}
                    </span>
                  </div>
                )}

                {/* Confirm Password */}
                <FormInput
                  id="signup-confirm-password"
                  label="Confirm Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmPasswordError}
                  disabled={isSubmitting}
                  required
                  icon={
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  }
                />

                {/* User Agreements */}
                <div style={{ marginTop: "var(--space-2)" }}>
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      className="auth-checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      disabled={isSubmitting}
                    />
                    <span>
                      I agree to the <a href="#terms" onClick={(e) => {e.preventDefault(); alert("We respect your data. Your files are processed entirely locally.");}} style={{ color: "var(--accent-primary)" }}>Terms of Service</a> and <a href="#privacy" onClick={(e) => {e.preventDefault(); alert("Local privacy guaranteed.");}} style={{ color: "var(--accent-primary)" }}>Privacy Policy</a>
                    </span>
                  </label>
                  {termsError && <span className="auth-input-error" style={{ display: "block", marginTop: "4px" }}>{termsError}</span>}
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="auth-spinner"></span>
                      Registering...
                    </>
                  ) : (
                    <>
                      Create Account
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Separator Line */}
              <div className="auth-divider">or continue with</div>

              {/* Social Login Grid */}
              <div className="auth-oauth-grid">
                <button
                  type="button"
                  className="auth-oauth-btn"
                  onClick={async () => {
                    setIsSubmitting(true);
                    await loginWithGoogle();
                    setIsSubmitting(false);
                  }}
                  disabled={isSubmitting}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.25.61 4.47 1.635l2.437-2.437C17.312 1.48 14.93 0 12.24 0 6.033 0 1 5.033 1 11.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.985 0-.74-.067-1.3-.193-1.854H12.24z"/>
                  </svg>
                  Google
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SignUp;
