import React from "react";
import Slider from "../ui/Slider";
import Select from "../ui/Select";
import Toggle from "../ui/Toggle";
import Input from "../ui/Input";

/**
 * ControlRenderer — Generic UI component for service settings.
 * Renders an input based on the 'type' field in the config.
 */
const ControlRenderer = ({ control, value, onChange }) => {
  const isDisabled = control.disabled;

  return (
    <div
      className={`control-wrapper-outer ${isDisabled ? "control-disabled" : ""}`}
      key={control.id}
    >
      {control.type === "select" && (
        <Select
          label={control.label}
          options={control.options}
          value={value}
          disabled={isDisabled}
          onChange={(val) => onChange(control.id, val, control.parse)}
        />
      )}

      {control.type === "range" && (
        <Slider
          label={control.label}
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          disabled={isDisabled}
          onChange={(val) => onChange(control.id, val, parseFloat)}
        />
      )}

      {control.type === "text" && (
        <Input
          label={control.label}
          placeholder={control.placeholder}
          value={value}
          disabled={isDisabled}
          onChange={(e) => onChange(control.id, e.target.value)}
        />
      )}

      {control.type === "toggle" && (
        <Toggle
          label={control.label}
          value={value}
          disabled={isDisabled}
          onChange={(val) => onChange(control.id, val)}
        />
      )}
    </div>
  );
};

export default ControlRenderer;
