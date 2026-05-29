import React, { useRef, useCallback, useEffect } from "react";
import { useService } from "../../../context/AppContext";
import { useSAM } from "../../../hooks/useSAM";

const SAMOverlay = ({ srcRef }) => {
  const { currentService } = useService();
  const { samPoints, addPoint } = useSAM();
  const overlayRef = useRef(null);

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
    if (srcRef.current) ro.observe(srcRef.current);
    window.addEventListener("resize", sync);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [srcRef, currentService]);

  const handleMouseDown = useCallback(
    (e) => {
      if (currentService?.id !== "object-segmentation") return;

      const rect = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      if (e.button === 2) {
        e.preventDefault();
      }

      // Right-click or holding modified keys makes it a negative point (label: 0)
      const isShortcutNegative =
        e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;

      addPoint(x, y, isShortcutNegative ? 0 : null);
    },
    [currentService, addPoint],
  );

  if (currentService?.id !== "object-segmentation") return null;

  return (
    <div
      ref={overlayRef}
      className="sam-selection-overlay"
      onMouseDown={handleMouseDown}
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
  );
};

export default SAMOverlay;
