import React, { useState, useEffect, useActionState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store";
import FormInput from "../components/ui/FormInput";
import Logo from "../components/ui/Logo";

const Login = () => {
  const { login, isAuthenticated, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Simple visual UI states (password visibility & remember me)
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const origin = location.state?.from?.pathname || "/services";
      navigate(origin, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // React 19 Action handler using useActionState
  const [formState, formAction, isPending] = useActionState(
    async (prevState, formData) => {
      const email = formData.get("email")?.trim();
      const password = formData.get("password");

      // Validate inputs inside the action
      let errors = {};
      if (!email) {
        errors.email = "Email address is required.";
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        errors.email = "Please enter a valid email address.";
      }

      if (!password) {
        errors.password = "Password is required.";
      } else if (password.length < 6) {
        errors.password = "Password must be at least 6 characters.";
      }

      if (Object.keys(errors).length > 0) {
        return { errors };
      }

      // Simulate standard network latency for premium feel (active spinner)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await login(email, password);
      if (result.success) {
        const origin = location.state?.from?.pathname || "/services";
        navigate(origin, { replace: true });
        return { success: true };
      }

      return { errors: { form: result.error } };
    },
    null
  );

  return (
    <div className="auth-container">
      <div className="auth-split">
        {/* Left Side: Premium Local AI Showcase */}
        <section className="auth-visual-side">
          <div className="auth-glow-sphere-1"></div>
          <div className="auth-glow-sphere-2"></div>
          
          <header className="auth-visual-header">
            <Logo />
          </header>

          <div className="auth-visual-body">
            <h1 className="auth-visual-title">
              Local Web-AI<br />
              <span>Image Processing</span>
            </h1>
            <p className="auth-visual-description">
              Upload your images and edit them directly inside your browser. No server uploads, total privacy, and blazing speed.
            </p>

            <div className="auth-feature-cards">
              <div className="auth-feature-card animate-slide-up" style={{ animationDelay: "100ms" }}>
                <span className="auth-feature-card-icon">✂️</span>
                <div>
                  <h4 className="auth-feature-card-title">Background Removal</h4>
                  <p className="auth-feature-card-desc">Extract subjects instantly with zero-latency web model execution.</p>
                </div>
              </div>

              <div className="auth-feature-card animate-slide-up" style={{ animationDelay: "200ms" }}>
                <span className="auth-feature-card-icon">🔎</span>
                <div>
                  <h4 className="auth-feature-card-title">Super Upscaling</h4>
                  <p className="auth-feature-card-desc">Enhance texture detail up to 4x resolution using local ESRGAN.</p>
                </div>
              </div>

              <div className="auth-feature-card animate-slide-up" style={{ animationDelay: "300ms" }}>
                <span className="auth-feature-card-icon">✨</span>
                <div>
                  <h4 className="auth-feature-card-title">Smart Magic Eraser</h4>
                  <p className="auth-feature-card-desc">Remove unwanted items or people smoothly inside seconds.</p>
                </div>
              </div>
            </div>
          </div>

          <footer className="auth-visual-footer">
            <p>© 2026 Image Boss Inc. Privacy First, Web-Local AI Toolkit.</p>
          </footer>
        </section>

        {/* Right Side: Log In Card Shell */}
        <main className="auth-form-side">
          <div className="auth-form-wrapper">
            <header className="auth-form-header">
              <Link to="/" className="auth-logo-link" style={{ display: "none" }}>
                ⚡ IMAGE BOSS
              </Link>
              <h2 className="auth-form-title">Welcome back</h2>
              <p className="auth-form-subtitle">
                Don't have an account? <Link to="/signup">Sign up for free</Link>
              </p>
            </header>

            <div className="auth-card">
              <form className="auth-form" action={formAction} noValidate>
                {/* Email Input */}
                <FormInput
                  id="login-email"
                  name="email"
                  label="Email Address"
                  type="email"
                  placeholder="name@company.com"
                  error={formState?.errors?.email}
                  disabled={isPending}
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
                  id="login-password"
                  name="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  error={formState?.errors?.password}
                  disabled={isPending}
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

                {/* Extras block */}
                <div className="auth-extras">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      className="auth-checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isPending}
                    />
                    Remember me
                  </label>
                  <a
                    href="#forgot"
                    className="auth-forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Hint: Use admin@imageboss.com / password123 to log in immediately!");
                    }}
                  >
                    Forgot password?
                  </a>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <span className="auth-spinner"></span>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
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

export default Login;
