import React from "react";

/**
 * Reusable, atomic Arrow Button component.
 * Supports various directions with premium micro-animations.
 */
const ArrowButton = ({
  direction = "left",
  onClick,
  className = "",
  disabled = false,
  label = "Go back",
}) => {
  // SVG path for chevron
  const getChevronPath = () => {
    switch (direction) {
      case "right":
        return "M9 5l7 7-7 7";
      case "up":
        return "M19 15l-7-7-7 7";
      case "down":
        return "M5 9l7 7 7-7";
      case "left":
      default:
        return "M15 19l-7-7 7-7";
    }
  };

  return (
    <button
      type="button"
      className={`arrow-button dir-${direction} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
        className="arrow-icon"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={getChevronPath()} />
      </svg>
    </button>
  );
};

export default ArrowButton;
