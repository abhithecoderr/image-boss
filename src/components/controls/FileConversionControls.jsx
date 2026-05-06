import { useEffect } from 'react';
import { useApp } from "../../context/AppContext";
import { CONTROLS_CONFIG } from "../../config/controls";
import ControlRenderer from "../shared/ControlRenderer";

const FileConversionControls = () => {
  const { serviceSettings, updateServiceSetting, originalFile } = useApp();

  useEffect(() => {
    if (originalFile) {
        const mime = originalFile.type || 'application/octet-stream';
        if (serviceSettings['file-conversion']?.inputFormat !== mime) {
            updateServiceSetting('file-conversion', 'inputFormat', mime);
        }
    }
  }, [originalFile, updateServiceSetting, serviceSettings]);

  const configs = CONTROLS_CONFIG['file-conversion'];
  const settings = serviceSettings['file-conversion'] || {};

  const handleChange = (id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;
    updateServiceSetting('file-conversion', id, parsedVal);
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

export default FileConversionControls;
