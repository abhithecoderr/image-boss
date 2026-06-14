/*
 * Dropdown control for toggling between applying settings to a single active image or the entire batch.
 */
import React from "react";
import { useWorkspace, useService } from "../../store";
import Button from "../ui/Button";

const BatchSettingsSelector = () => {
  const { currentService } = useService();
  const { items, activeItemId, setActiveItemId, batchSettingsTarget, setBatchSettingsTarget } = useWorkspace();

  if (items.length <= 1) return null;

  const handleSelectAll = () => {
    setBatchSettingsTarget("all");
  };

  const handleSelectItem = (item, index) => {
    setBatchSettingsTarget(item.id);
    setActiveItemId(item.id);
  };

  return (
    <div className="batch-settings-selector-container">
      <span className="batch-settings-selector-label">Configure:</span>
      <div className="batch-settings-selector-row">
        <Button
          variant={batchSettingsTarget === "all" ? "primary" : "secondary"}
          size="tiny"
          onClick={handleSelectAll}
          className={batchSettingsTarget === "all" ? "active" : ""}
        >
          All Images
        </Button>

        <div className="batch-settings-divider" />

        <div className="batch-settings-items-scroll">
          {items.map((item, idx) => {
            const isSelected = batchSettingsTarget === item.id;
            
            // Check if this item has any custom overrides in its settings overrides
            const hasOverrides =
              item.settingsOverrides &&
              Object.keys(item.settingsOverrides).some(
                (serviceOrStepId) =>
                  item.settingsOverrides[serviceOrStepId] &&
                  Object.keys(item.settingsOverrides[serviceOrStepId]).length > 0
              );

            return (
              <Button
                key={item.id}
                variant={isSelected ? "primary" : "secondary"}
                size="tiny"
                onClick={() => handleSelectItem(item, idx)}
                className={`batch-settings-num-btn ${isSelected ? "active" : ""} ${hasOverrides ? "has-overrides" : ""}`}
                title={`Configure Image ${idx + 1}${hasOverrides ? " (has custom settings)" : ""}`}
              >
                {idx + 1}
                {hasOverrides && <span className="override-dot">•</span>}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BatchSettingsSelector;
