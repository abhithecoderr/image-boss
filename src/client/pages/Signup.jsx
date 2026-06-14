import React, { useState, useEffect, useActionState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store";
import FormInput from "../components/ui/FormInput";
import Logo from "../components/ui/Logo";
import {
  UserIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  GoogleIcon
} from "../components/ui/Icons";

const SignUp = () => {
  const { signup, isAuthenticated, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Keep password state purely for the live strength meter feedback
  const [passwordVal, setPasswordVal] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState({ score: 0, label: "", class: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/services", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Live password strength calculation
  useEffect(() => {
    if (!passwordVal) {
      setStrength({ score: 0, label: "", class: "" });
      return;
    }

    let score = 0;
    if (passwordVal.length >= 6) score += 1;
    if (passwordVal.length >= 10) score += 1;
    if (/[A-Z]/.test(passwordVal)) score += 1;
    if (/[0-9]/.test(passwordVal)) score += 1;
    if (/[^A-Za-z0-9]/.test(passwordVal)) score += 1;

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
  }, [passwordVal]);

  // React 19 Action handler using useActionState
  const [formState, formAction, isPending] = useActionState(
    async (prevState, formData) => {
      const name = formData.get("name")?.trim();
      const email = formData.get("email")?.trim();
      const password = formData.get("password");
      const confirmPassword = formData.get("confirmPassword");
      const termsAccepted = formData.get("termsAccepted") === "on";

      // Form Validation
      let errors = {};

      if (!name) {
        errors.name = "Full name is required.";
      }

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

      if (password !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
      }

      if (!termsAccepted) {
        errors.terms = "You must agree to the Terms of Service.";
      }

      if (Object.keys(errors).length > 0) {
        return { errors };
      }

      // Simulate standard network latency for premium feel (active spinner)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await signup(name, email, password);
      if (result.success) {
        navigate("/services", { replace: true });
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
              Start Creating<br />
              <span>Beautiful Assets</span>
            </h1>
            <p className="auth-visual-description">
              Join thousands of creators using local browser-based models to transform assets instantly. Completely private.
            </p>

            <div className="auth-feature-cards">
              <div className="auth-feature-card animate-slide-up">
                <span className="auth-feature-card-icon">⚡</span>
                <div>
                  <h4 className="auth-feature-card-title">100% Web Local</h4>
                  <p className="auth-feature-card-desc">No queues, no high subscription fees. Runs directly on your GPU.</p>
                </div>
              </div>

              <div className="auth-feature-card animate-slide-up">
                <span className="auth-feature-card-icon">🔒</span>
                <div>
                  <h4 className="auth-feature-card-title">Strict Privacy Safeguard</h4>
                  <p className="auth-feature-card-desc">Your images never leave your machine. Perfect for secure enterprise workflows.</p>
                </div>
              </div>

              <div className="auth-feature-card animate-slide-up">
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
              <form className="auth-form" action={formAction} noValidate>
                {/* Full Name */}
                <FormInput
                  id="signup-name"
                  name="name"
                  label="Full Name"
                  type="text"
                  placeholder="John Doe"
                  error={formState?.errors?.name}
                  disabled={isPending}
                  required
                  icon={<UserIcon size={15} strokeWidth={2} />}
                />

                {/* Email Input */}
                <FormInput
                  id="signup-email"
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
                  id="signup-password"
                  name="password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  error={formState?.errors?.password}
                  disabled={isPending}
                  value={passwordVal}
                  onChange={(e) => setPasswordVal(e.target.value)}
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

                {/* Password Strength Meter */}
                {passwordVal && (
                  <div className="auth-strength-meter">
                    <div className="auth-strength-bars">
                      <div className={`auth-strength-bar ${strength.score >= 1 ? strength.class : ""}`}></div>
                      <div className={`auth-strength-bar ${strength.score >= 3 ? strength.class : ""}`}></div>
                      <div className={`auth-strength-bar ${strength.score >= 5 ? strength.class : ""}`}></div>
                    </div>
                    <span className={`auth-strength-label is-${strength.class || 'weak'}`}>
                      Password Strength: {strength.label}
                    </span>
                  </div>
                )}

                {/* Confirm Password */}
                <FormInput
                  id="signup-confirm-password"
                  name="confirmPassword"
                  label="Confirm Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  error={formState?.errors?.confirmPassword}
                  disabled={isPending}
                  required
                  icon={<LockIcon size={15} strokeWidth={2} />}
                />

                {/* User Agreements */}
                <div className="auth-terms-block">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      name="termsAccepted"
                      className="auth-checkbox"
                      disabled={isPending}
                    />
                    <span>
                      I agree to the <a href="#terms" className="auth-inline-link" onClick={(e) => {e.preventDefault(); alert("We respect your data. Your files are processed entirely locally.");}}>Terms of Service</a> and <a href="#privacy" className="auth-inline-link" onClick={(e) => {e.preventDefault(); alert("Local privacy guaranteed.");}}>Privacy Policy</a>
                    </span>
                  </label>
                  {formState?.errors?.terms && <span className="auth-input-error auth-terms-error">{formState?.errors?.terms}</span>}
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
                      Registering...
                    </>
                  ) : (
                    <>
                      Create Account
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

export default SignUp;
