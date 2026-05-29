import React from "react";

/**
 * Standardized Premium Minimal Button Component
 */
const Button = ({
  children,
  onClick,
  variant = "secondary", // primary, secondary, tertiary, danger
  size = "medium",       // large, medium, tiny
  isLoading = false,
  disabled = false,
  icon = null,
  type = "button",
  className = "",
  title = "",
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${isLoading ? "is-loading" : ""} ${className}`}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      {...props}
    >
      {isLoading && (
        <span className="btn-spinner">
          <svg
            className="spinner-svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="8"
              cy="8"
              r="7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="32"
              strokeDashoffset="12"
            />
          </svg>
        </span>
      )}
      {!isLoading && icon && <span className="btn-icon">{icon}</span>}
      <span className="btn-content">{children}</span>
    </button>
  );
};

export default React.memo(Button);
