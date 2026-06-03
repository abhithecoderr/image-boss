import React from "react";
import { Link } from "react-router-dom";

/**
 * Standardized Premium Minimal Logo Component
 */
const Logo = ({
  to = "/",
  showIcon = true,
  className = "",
  style = {},
  size = 44,
  ...props
}) => {
  const content = (
    <div className={`brand-logo-wrapper ${className}`} style={{ gap: '10px', ...style }} {...props}>
      {showIcon && (
        <img
          className="brand-logo-icon"
          src="/images/logo/imageboss_logo_background-removal.png"
          alt="Image Boss Logo"
          width={size}
          height={size}
          style={{ objectFit: "contain", transition: "transform var(--transition-normal)" }}
        />
      )}
      <span className="brand-logo-text" style={{ fontSize: `${size * 0.45}px`, fontWeight: '600', letterSpacing: '-0.02em' }}>
        Image Boss
      </span>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="brand-logo-link" style={{ textDecoration: "none", color: "inherit" }}>
        {content}
      </Link>
    );
  }

  return content;
};

export default Logo;
