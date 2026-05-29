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
  ...props
}) => {
  const content = (
    <div className={`brand-logo-wrapper ${className}`} style={style} {...props}>
      {showIcon && (
        <svg
          className="brand-logo-icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* A beautiful minimal line rocket icon */}
          <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5" />
          <path d="M12 2C6 2 2 6 2 12c0 2.5 1.5 4.5 3.5 5.5.5-2.5 2-4.5 4.5-5.5 1-2.5 3-4 5.5-4.5C18 7 20 8.5 20 12c-.5 2.5-2 4.5-4.5 5.5-1 2.5-3 4-5.5 4.5.5.5 1.5 1 2.5 1.5 6 0 10-4 10-10C22 6 18 2 12 2z" />
          <circle cx="12" cy="10" r="1.5" />
        </svg>
      )}
      <span className="brand-logo-text">Image Boss</span>
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

export default React.memo(Logo);
