import { useApp } from "../../context/AppContext";
import { useSAM } from "../../hooks/useSAM";
import { CONTROLS_CONFIG } from "../../config/controls";
import ControlRenderer from "../shared/ControlRenderer";

const ObjectSegmentationControls = () => {
  const { serviceSettings, updateServiceSetting } = useApp();
  const { clearPoints } = useSAM();

  const configs = CONTROLS_CONFIG['object-segmentation'];
  const settings = serviceSettings['object-segmentation'] || {};

  const handleChange = (id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;
    updateServiceSetting('object-segmentation', id, parsedVal);
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
      <div className="control-group" style={{ alignItems: 'flex-end' }}>
        <button className="btn btn-secondary btn-tiny" onClick={clearPoints}>Clear Selection</button>
      </div>
    </>
  );
};

export default ObjectSegmentationControls;
