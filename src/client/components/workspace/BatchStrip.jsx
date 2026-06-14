/**
 * Horizontal thumbnail strip for batch mode.
 * Renders above the source canvas. Supports:
 * - Drag-to-reorder (native HTML5 DnD)
 * - Click to view, Ctrl+Click to multi-select
 * - Add button (+) to upload more
 * - Status badges per item
 * - Remove on hover (×)
 */

import React, { useRef, useState } from "react";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { useProcessor } from "../../hooks/useProcessorContext";
import { processorEngine } from "../../core/processor-engine";

// Premium thin-line vector status icons
const STATUS_ICONS = {
  pending: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  done: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

const BatchStrip = () => {
  const batch = useProcessor();
  const {
    items,
    activeItemId,
    selectedIds,
    selectItem: onSelectItem,
    toggleItemSelection: onToggleSelect,
    reorderItems: onReorder,
    removeItem: onRemove,
    addFiles: onAddFiles,
  } = batch;

  const onClearMemory = () => {
    processorEngine.clearActiveProcessor();
  };

  const fileInputRef = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragItemIdx = useRef(null);

  // --- Drag Handlers ---
  const handleDragStart = (e, idx) => {
    dragItemIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image semi-transparent
    e.currentTarget.style.opacity = "0.4";
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = "1";
    dragItemIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  };

  const handleDrop = (e, toIdx) => {
      e.preventDefault();
      const fromIdx = dragItemIdx.current;
      if (fromIdx !== null && fromIdx !== toIdx) {
        onReorder(fromIdx, toIdx);
      }
      dragItemIdx.current = null;
      setDragOverIdx(null);
    };

  // --- Click Handler ---
  const handleClick = (e, id) => {
      if (e.ctrlKey || e.metaKey) {
        onToggleSelect(id);
      } else {
        onSelectItem(id);
      }
    };

  // --- File Add ---
  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      onAddFiles(e.target.files);
      e.target.value = ""; // reset so same file can be re-added
    }
  };

  if (items.length === 0) {
    // Empty state: just the add button as a larger area
    return (
      <div className="batch-strip batch-strip--empty">
        <div
          className="batch-add-box batch-add-box--large"
          onClick={handleAddClick}
        >
          <span className="batch-add-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          <span className="batch-add-label">Add images to batch</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/bmp,image/gif,image/tiff,image/x-icon,image/x-portable-anymap"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <div className="batch-strip">
      <div className="batch-strip-scroll">
        {items.map((item, idx) => {
          const isActive = item.id === activeItemId;
          const isSelected = selectedIds.has(item.id);
          const isDragTarget = dragOverIdx === idx;

          return (
            <div
              key={item.id}
              className={[
                "batch-thumb",
                isActive && "batch-thumb--active",
                isSelected && "batch-thumb--selected",
                isDragTarget && "batch-thumb--drag-over",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onClick={(e) => handleClick(e, item.id)}
              title={`${item.name}\nCtrl+Click to select for download`}
            >
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.name}
                  className="batch-thumb-img"
                  draggable={false}
                />
              ) : (
                <div className="batch-thumb-placeholder" />
              )}

              {/* Status badge */}
              <Badge
                variant={
                  item.status === "done"
                    ? "success"
                    : item.status === "error"
                    ? "error"
                    : item.status === "processing"
                    ? "primary"
                    : "warning"
                }
                pill
                className="batch-status"
                icon={
                  item.status === "processing" ? (
                    <span className="batch-spinner" />
                  ) : (
                    STATUS_ICONS[item.status]
                  )
                }
              />

              {/* Selection checkmark */}
              {isSelected && (
                <span className="batch-check">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}

              {/* Remove button on hover */}
              <Button
                variant="secondary"
                size="tiny"
                className="batch-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                title="Remove from batch"
                icon={
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                }
              />
            </div>
          );
        })}

        {/* Add more button */}
        <div
          className="batch-add-box"
          onClick={handleAddClick}
          title="Add more images"
        >
          <span className="batch-add-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
        </div>
      </div>

      <div className="batch-actions">
        <Button
          variant="secondary"
          size="tiny"
          className="batch-clear-btn"
          onClick={onClearMemory}
          title="Free up RAM by clearing intermediate workflow results and AI models"
          icon={
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          }
        >
          Clear Memory
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
};

export default BatchStrip;
