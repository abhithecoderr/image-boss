import React from "react";

/**
 * Standardized Premium Minimal Input Component
 */
const Input = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  disabled = false,
  className = "",
  id,
  ...props
}) => {
  return (
    <div className={`premium-input-container ${disabled ? "is-disabled" : ""} ${className}`}>
      {label && <label className="control-label" htmlFor={id}>{label}</label>}
      <input
        id={id}
        type={type}
        className="control-input"
        placeholder={placeholder}
        value={value ?? ""}
        disabled={disabled}
        onChange={onChange}
        {...props}
      />
    </div>
  );
};

export default React.memo(Input);
