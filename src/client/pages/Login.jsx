import React, { useState, useEffect, useActionState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store";
import FormInput from "../components/ui/FormInput";
import Logo from "../components/ui/Logo";
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  GoogleIcon
} from "../components/ui/Icons";

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
              <div className="auth-feature-card animate-slide-up">
                <span className="auth-feature-card-icon">✂️</span>
                <div>
                  <h4 className="auth-feature-card-title">Background Removal</h4>
                  <p className="auth-feature-card-desc">Extract subjects instantly with zero-latency web model execution.</p>
                </div>
              </div>

              <div className="auth-feature-card animate-slide-up">
                <span className="auth-feature-card-icon">🔎</span>
                <div>
                  <h4 className="auth-feature-card-title">Super Upscaling</h4>
                  <p className="auth-feature-card-desc">Enhance texture detail up to 4x resolution using local ESRGAN.</p>
                </div>
              </div>

              <div className="auth-feature-card animate-slide-up">
                <span className="auth-feature-card-icon">✨</span>
                <div>
                  <h4 className="auth-feature-card-title">Smart Magic Eraser</h4>
                  <p className="auth-feature-card-desc">Remove unwanted items or people smoothly inside seconds.</p>
                </div>
              </div>
            </div>
          </div>

          <footer className="auth-visual-footer">
            <p>
              <Link to="/privacy-policy" className="auth-footer-link">Privacy Policy</Link> •{" "}
              <Link to="/terms-of-service" className="auth-footer-link">Terms of Service</Link> •{" "}
              <Link to="/refund-policy" className="auth-footer-link">Refund Policy</Link>
            </p>
            <p>© 2026 Image Boss Inc. Privacy First, Web-Local AI Toolkit.</p>
          </footer>
        </section>

        {/* Right Side: Log In Card Shell */}
        <main className="auth-form-side">
          <div className="auth-form-wrapper">
            <header className="auth-form-header">
              <Link to="/" className="auth-logo-link hidden">
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
                  icon={<MailIcon size={15} strokeWidth={2} />}
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
                  icon={<LockIcon size={15} strokeWidth={2} />}
                >
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? (
                      <EyeOffIcon size={18} strokeWidth={2} />
                    ) : (
                      <EyeIcon size={18} strokeWidth={2} />
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
                      <ArrowRightIcon size={16} strokeWidth={2.5} />
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
                  <GoogleIcon size={16} />
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
