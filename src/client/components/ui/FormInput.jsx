import React from "react";

/**
 * Premium Form Input Component designed specifically for clean, interactive forms
 * with visual validation errors, icons, and beautiful focus states.
 */
const FormInput = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  error = "",
  disabled = false,
  required = false,
  className = "",
  id,
  children,
  icon,
  ...props
}) => {
  return (
    <div className={`auth-field-group ${className}`}>
      {label && (
        <label className="auth-label" htmlFor={id}>
          {label} {required && <span style={{ color: "var(--accent-primary)" }}>*</span>}
        </label>
      )}
      
      <div className="auth-input-container">
        {icon && (
          <span style={{
            position: "absolute",
            left: "var(--space-3)",
            top: "0",
            bottom: "0",
            color: "var(--text-dim)",
            display: "flex",
            alignItems: "center",
            pointerEvents: "none"
          }}>
            {icon}
          </span>
        )}
        
        <input
          id={id}
          type={type}
          className={`auth-input ${error ? "has-error" : ""}`}
          style={icon ? { paddingLeft: "38px" } : {}}
          placeholder={placeholder}
          disabled={disabled}
          {...(value !== undefined ? { value } : {})}
          onChange={onChange}
          {...props}
        />
        
        {children}
      </div>
      
      {error && <span className="auth-input-error">{error}</span>}
    </div>
  );
};

export default FormInput;
