import React, { useRef, useEffect, useState } from "react";
import { useService, useWorkspace } from "../../../store";
import { useSAM } from "../../../hooks/useSAM";
import { useMediaQuery } from "../../../hooks/useMediaQuery";

const SAMOverlay = ({ srcRef }) => {
  const { currentService } = useService();
  const { samPoints, addPoint } = useSAM();
  const isProcessing = useWorkspace((state) => state.isProcessing);
  const overlayRef = useRef(null);

  // On touch devices there's no right-click / shift / ctrl. A small floating
  // toggle lets the user switch between Positive (include) and Negative (exclude) taps.
  const isTouch = useMediaQuery("(hover: none), (pointer: coarse)");
  const [touchNegative, setTouchNegative] = useState(false);

  // Sync overlay position/size with source image canvas
  useEffect(() => {
    if (currentService?.id !== "object-segmentation") return;

    const sync = () => {
      if (!overlayRef.current || !srcRef.current) return;
      const canvas = srcRef.current;
      const overlay = overlayRef.current;

      overlay.style.width = `${canvas.offsetWidth}px`;
      overlay.style.height = `${canvas.offsetHeight}px`;
      overlay.style.left = `${canvas.offsetLeft}px`;
      overlay.style.top = `${canvas.offsetTop}px`;
    };

    sync();

    const ro = new ResizeObserver(sync);
    if (srcRef.current) {
      ro.observe(srcRef.current);
      if (srcRef.current.parentElement) {
        ro.observe(srcRef.current.parentElement);
      }
    }
    window.addEventListener("resize", sync);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [srcRef, currentService?.id, isProcessing]);

  const placePoint = (clientX, clientY, isNegative) => {
    if (currentService?.id !== "object-segmentation") return;
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    addPoint(x, y, isNegative ? 0 : null);
  };

  const handleMouseDown = (e) => {
    if (currentService?.id !== "object-segmentation") return;

    if (e.button === 2) {
      e.preventDefault();
    }

    // Right-click or holding modified keys makes it a negative point (label: 0)
    const isShortcutNegative =
      e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;

    placePoint(e.clientX, e.clientY, isShortcutNegative);
  };

  // Touch: respect the floating toggle for positive/negative.
  const handleTouchStart = (e) => {
    if (currentService?.id !== "object-segmentation") return;
    if (e.touches.length === 0) return;
    // Prevent the browser from also firing a synthetic mouse event + scrolling.
    e.preventDefault();
    const touch = e.touches[0];
    placePoint(touch.clientX, touch.clientY, touchNegative);
  };

  if (currentService?.id !== "object-segmentation") return null;

  return (
    <>
      {isTouch && (
        <div className="sam-touch-toggle" role="group" aria-label="Point type">
          <button
            type="button"
            className={`sam-touch-toggle-btn${!touchNegative ? " is-active positive" : ""}`}
            onClick={() => setTouchNegative(false)}
          >
            + Include
          </button>
          <button
            type="button"
            className={`sam-touch-toggle-btn${touchNegative ? " is-active negative" : ""}`}
            onClick={() => setTouchNegative(true)}
          >
            − Exclude
          </button>
        </div>
      )}

      <div
        ref={overlayRef}
        className="sam-selection-overlay"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: "crosshair" }}
      >
        {/* Point indicators for selection refinement */}
        {samPoints.map((point, idx) => (
          <div
            key={idx}
            className={`sam-point ${point.label === 1 ? "positive" : "negative"}`}
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
            }}
          />
        ))}
      </div>
    </>
  );
};

export default SAMOverlay;
