import React from "react";

/**
 * Standardized Premium Minimal Badge Component
 * Renders status chips or tags with custom variants
 */
const Badge = ({
  children,
  variant = "secondary", // success, warning, error, info, primary, secondary
  pill = false,
  icon = null,
  className = "",
  title = "",
  ...props
}) => {
  return (
    <span
      className={`badge badge-${variant} ${pill ? "badge-pill" : ""} ${className}`}
      title={title}
      {...props}
    >
      {icon && <span className="badge-icon">{icon}</span>}
      <span className="badge-content">{children}</span>
    </span>
  );
};

export default Badge;
