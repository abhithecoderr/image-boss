/*
 * Manages active services and individual parameter values for all tool settings.
 */
import { create } from "zustand";
import { CONTROLS_CONFIG } from "../config/controls";

const getInitialServiceSettings = () => {
  const initial = {};
  Object.keys(CONTROLS_CONFIG).forEach((serviceId) => {
    const defaults = {};
    CONTROLS_CONFIG[serviceId].forEach((control) => {
      if (control.defaultValue !== undefined) {
        defaults[control.id] = control.defaultValue;
      }
    });
    initial[serviceId] = defaults;
  });
  return initial;
};

export const useServiceStore = create((set) => ({
  serviceSettings: getInitialServiceSettings(),
  activeServiceId: null,
  setActiveServiceId: (id) => set({ activeServiceId: id }),

  setServiceSettings: (serviceSettings) => set({ serviceSettings }),

  updateServiceSetting: (sId, settingId, value) =>
    set((state) => ({
      serviceSettings: {
        ...state.serviceSettings,
        [sId]: {
          ...state.serviceSettings[sId],
          [settingId]: value,
        },
      },
    })),
}));
