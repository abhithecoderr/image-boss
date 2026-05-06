import { useEffect, useRef } from 'react';
import { useApp } from "../../context/AppContext";
import { useAppEngine } from "../../hooks/useAppEngine";
import { CONTROLS_CONFIG } from "../../config/controls";
import ControlRenderer from "../shared/ControlRenderer";

const BackgroundRemovalControls = () => {
  const { serviceSettings, updateServiceSetting, originalCanvas, resultCanvas } = useApp();
  const { execute } = useAppEngine();
  const postProcessDebounceRef = useRef(null);

  const bgSettings = serviceSettings['background-removal'];

  useEffect(() => {
    if (!originalCanvas || !resultCanvas) return;

    clearTimeout(postProcessDebounceRef.current);
    postProcessDebounceRef.current = setTimeout(() => {
      execute({ ...serviceSettings['background-removal'], _postProcess: true });
    }, 80);

    return () => clearTimeout(postProcessDebounceRef.current);
  }, [bgSettings?.edgeShift, bgSettings?.edgeSmoothness, bgSettings?.edgeContrast]);

  const configs = CONTROLS_CONFIG['background-removal'];
  const settings = serviceSettings['background-removal'] || {};

  const handleChange = (id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;
    updateServiceSetting('background-removal', id, parsedVal);
  };

  if (!configs) return null;

  return (
    <>
      {configs.map(config => (
         (!config.visibleIf || config.visibleIf(settings)) && (
           <ControlRenderer
             key={config.id}
             control={config}
             value={settings[config.id]}
             onChange={handleChange}
           />
         )
      ))}
    </>
  );
};

export default BackgroundRemovalControls;
