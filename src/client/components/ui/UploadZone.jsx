import React, { useRef, useState } from "react";

/**
 * Standardized Premium Minimal Upload Zone Component
 * Unifies drag-and-drop and local file picking for both Workspace and Sandbox modes.
 */
const UploadZone = ({
  onFilesSelected,
  multiple = false,
  activeItem = null,
  hint = "Supports PNG, JPG, WebP, AVIF, BMP, GIF, TIFF, ICO (Max 5MB)",
  accept = "image/png,image/jpeg,image/webp,image/avif,image/bmp,image/gif,image/tiff,image/x-icon,image/x-portable-anymap",
  className = "",
}) => {
  const fileInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div
      className={[
        "upload-area",
        isDragActive && "upload-area--drag-active",
        activeItem && "upload-area--has-file",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={handleFileChange}
      />

      <div className="upload-content">
        {activeItem ? (
          <div className="upload-preview-pane">
            {activeItem.thumbnailUrl ? (
              <img
                src={activeItem.thumbnailUrl}
                alt={activeItem.name}
                className="upload-preview-thumb"
              />
            ) : (
              <div className="upload-preview-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}
            <span className="upload-preview-filename">{activeItem.name}</span>
            {activeItem.file && (
              <span className="upload-preview-size">
                {(activeItem.file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
            <span className="upload-preview-status">✓ Ready for processing</span>
          </div>
        ) : (
          <>
            <div className="upload-icon-wrapper">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h2>Drop your image here</h2>
            <p>or click to browse local files</p>
            {hint && <div className="upload-hint">{hint}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default UploadZone;
