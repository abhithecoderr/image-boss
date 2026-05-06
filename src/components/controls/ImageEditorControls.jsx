import { useApp } from "../../context/AppContext";
import { CONTROLS_CONFIG } from "../../config/controls";
import ControlRenderer from "../shared/ControlRenderer";

const ImageEditorControls = () => {
  const { serviceSettings, updateServiceSetting, activeEditorTab, setActiveEditorTab } = useApp();

  let configs = CONTROLS_CONFIG['image-editor'];
  const settings = serviceSettings['image-editor'] || {};

  const handleChange = (id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;
    updateServiceSetting('image-editor', id, parsedVal);
  };

  if (!configs) return null;

  configs = configs.filter(c => c.category === activeEditorTab);

  return (
    <>
      <div className="control-group editor-categories-box" style={{ gridColumn: '1 / -1' }}>
        <div className="tab-group control-tabs" style={{ width: '100%', justifyContent: 'space-between' }}>
          {[
            { id: 'composition', label: '📐 Comp' },
            { id: 'light', label: '☀️ Light' },
            { id: 'color', label: '🎨 Color' },
            { id: 'effects', label: '✨ Effects' },
            { id: 'filters', label: '🔮 Filters' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn btn-secondary tab-item ${activeEditorTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveEditorTab(tab.id)}
              style={{ flex: 1, fontSize: '12px', padding: '8px 4px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

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

export default ImageEditorControls;
