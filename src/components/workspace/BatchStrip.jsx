/**
 * BatchStrip — Horizontal thumbnail strip for batch mode.
 * Renders above the source canvas. Supports:
 * - Drag-to-reorder (native HTML5 DnD)
 * - Click to view, Ctrl+Click to multi-select
 * - Add button (+) to upload more
 * - Status badges per item
 * - Remove on hover (×)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';

const THUMB_SIZE = 56;

/**
 * Generate a thumbnail data URL from a canvas
 */
function canvasToThumbURL(canvas, size = THUMB_SIZE) {
  if (!canvas) return null;
  const thumb = document.createElement('canvas');
  thumb.width = size;
  thumb.height = size;
  const ctx = thumb.getContext('2d');

  // Fit the image within the square
  const scale = Math.min(size / canvas.width, size / canvas.height);
  const w = canvas.width * scale;
  const h = canvas.height * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;

  ctx.drawImage(canvas, x, y, w, h);
  return thumb.toDataURL('image/jpeg', 0.6);
}

const STATUS_ICONS = {
  pending: '⏳',
  processing: '⚙️',
  done: '✅',
  error: '❌',
};

const BatchStrip = ({
  items,
  activeItemId,
  selectedIds,
  onSelectItem,
  onToggleSelect,
  onReorder,
  onRemove,
  onAddFiles,
  onClearMemory,
}) => {
  const fileInputRef = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragItemIdx = useRef(null);

  // Cache thumbnails so they don't regenerate every render
  const [thumbs, setThumbs] = useState({});

  useEffect(() => {
    const newThumbs = {};
    let changed = false;
    items.forEach(item => {
      if (item.sourceCanvas && !thumbs[item.id]) {
        newThumbs[item.id] = canvasToThumbURL(item.sourceCanvas);
        changed = true;
      } else if (thumbs[item.id]) {
        newThumbs[item.id] = thumbs[item.id];
      }
    });
    if (changed) setThumbs(newThumbs);
  }, [items]); // intentionally not including thumbs to avoid loop

  // --- Drag Handlers ---
  const handleDragStart = useCallback((e, idx) => {
    dragItemIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image semi-transparent
    e.currentTarget.style.opacity = '0.4';
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.style.opacity = '1';
    dragItemIdx.current = null;
    setDragOverIdx(null);
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e, toIdx) => {
    e.preventDefault();
    const fromIdx = dragItemIdx.current;
    if (fromIdx !== null && fromIdx !== toIdx) {
      onReorder(fromIdx, toIdx);
    }
    dragItemIdx.current = null;
    setDragOverIdx(null);
  }, [onReorder]);

  // --- Click Handler ---
  const handleClick = useCallback((e, id) => {
    if (e.ctrlKey || e.metaKey) {
      onToggleSelect(id);
    } else {
      onSelectItem(id);
    }
  }, [onSelectItem, onToggleSelect]);

  // --- File Add ---
  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      onAddFiles(e.target.files);
      e.target.value = ''; // reset so same file can be re-added
    }
  };

  if (items.length === 0) {
    // Empty state: just the add button as a larger area
    return (
      <div className="batch-strip batch-strip--empty">
        <div className="batch-add-box batch-add-box--large" onClick={handleAddClick}>
          <span className="batch-add-icon">+</span>
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
                'batch-thumb',
                isActive && 'batch-thumb--active',
                isSelected && 'batch-thumb--selected',
                isDragTarget && 'batch-thumb--drag-over',
              ].filter(Boolean).join(' ')}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onClick={(e) => handleClick(e, item.id)}
              title={`${item.name}\nCtrl+Click to select for download`}
            >
              {thumbs[item.id] ? (
                <img
                  src={thumbs[item.id]}
                  alt={item.name}
                  className="batch-thumb-img"
                  draggable={false}
                />
              ) : (
                <div className="batch-thumb-placeholder" />
              )}

              {/* Status badge */}
              <span className={`batch-status batch-status--${item.status}`}>
                {item.status === 'processing' ? (
                  <span className="batch-spinner" />
                ) : (
                  STATUS_ICONS[item.status]
                )}
              </span>

              {/* Selection checkmark */}
              {isSelected && (
                <span className="batch-check">✓</span>
              )}

              {/* Remove button on hover */}
              <button
                className="batch-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                title="Remove from batch"
              >
                ×
              </button>
            </div>
          );
        })}

        {/* Add more button */}
        <div className="batch-add-box" onClick={handleAddClick} title="Add more images">
          <span className="batch-add-icon">+</span>
        </div>
      </div>

      <div className="batch-actions">
         <button 
           className="btn btn-secondary btn-tiny batch-clear-btn" 
           onClick={onClearMemory}
           title="Free up RAM by clearing intermediate workflow results and AI models"
         >
           🧹 Clear Memory
         </button>
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
