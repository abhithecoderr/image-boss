import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
}) => {
  const modalRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scrolling when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="confirm-modal-overlay animate-fade-in" onClick={onClose}>
      <div
        ref={modalRef}
        className="confirm-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="confirm-modal-title">{title}</h3>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-footer">
          <Button variant="secondary" size="small" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={onConfirm}
            style={isDanger ? { backgroundColor: "#ff5c5c", borderColor: "#ff5c5c" } : {}}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ConfirmModal;
