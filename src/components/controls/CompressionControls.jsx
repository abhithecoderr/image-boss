import { useState, useEffect, useRef } from 'react';
import { useApp } from "../../context/AppContext";
import { useAppEngine } from "../../hooks/useAppEngine";
import { CONTROLS_CONFIG } from "../../config/controls";
import ControlRenderer from "../shared/ControlRenderer";
import { formatFileSize } from "../../core/ui-utils";

const CompressionControls = () => {
  const { serviceSettings, updateServiceSetting, originalCanvas, originalFile } = useApp();
  const { engine: batch } = useAppEngine();
  const [estimatedSize, setEstimatedSize] = useState(null);
  const estimateDebounceRef = useRef(null);

  useEffect(() => {
    if (!originalCanvas) {
      setEstimatedSize(null);
      return;
    }
    const quality = (serviceSettings?.compression?.quality ?? 80) / 100;

    clearTimeout(estimateDebounceRef.current);
    estimateDebounceRef.current = setTimeout(() => {
      originalCanvas.toBlob(
        (blob) => { if (blob) setEstimatedSize(blob.size); },
        'image/jpeg',
        quality
      );
    }, 150);

    return () => clearTimeout(estimateDebounceRef.current);
  }, [originalCanvas, serviceSettings?.compression?.quality]);

  const configs = CONTROLS_CONFIG['compression'];
  const settings = serviceSettings['compression'] || {};

  const handleChange = (id, val, parse) => {
    const parsedVal = parse ? parse(val) : val;
    updateServiceSetting('compression', id, parsedVal);
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

      <div className="control-group compression-preview" style={{
        background: 'rgba(0,0,0,0.3)',
        padding: '12px',
        borderRadius: '8px',
        marginTop: '12px',
        border: '1px dashed #444'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85em' }}>
          <span style={{ color: '#888' }}>Original Size:</span>
          <span style={{ fontWeight: '600' }}>
            {(() => {
              const item = batch.items.find(i => i.id === batch.activeItemId);
              const file = item?.file || originalFile;
              return file ? formatFileSize(file.size) : 'Unknown';
            })()}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em' }}>
          <span style={{ color: '#888' }}>Est. Final Size:</span>
          <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
            {estimatedSize != null ? formatFileSize(estimatedSize) : '...'}
          </span>
        </div>
        <div style={{ marginTop: '8px', height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${settings.quality || 80}%`,
            background: 'linear-gradient(90deg, #4CAF50, #8BC34A)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>
    </>
  );
};

export default CompressionControls;
