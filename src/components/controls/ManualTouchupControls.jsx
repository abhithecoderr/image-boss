import { useApp } from "../../context/AppContext";

const ManualTouchupControls = () => {
  const { editing, setEditing } = useApp();

  return (
    <div className="control-group control-section-divider">
      <label className="control-label" style={{ marginBottom: '12px' }}>Manual Mask Touch-up</label>
      <div className="control-manual-touchup">
        <div className="tab-group control-tabs">
          <button
            className={`btn btn-secondary ${editing.activeTool === 'none' ? 'active' : ''}`}
            onClick={() => setEditing(prev => ({ ...prev, activeTool: 'none' }))}
          >
            ✋ Move
          </button>
          <button
            className={`btn btn-secondary ${editing.activeTool === 'erase' ? 'active' : ''}`}
            onClick={() => setEditing(prev => ({ ...prev, activeTool: 'erase' }))}
          >
            🧽 Erase
          </button>
          <button
            className={`btn btn-secondary ${editing.activeTool === 'restore' ? 'active' : ''}`}
            onClick={() => setEditing(prev => ({ ...prev, activeTool: 'restore' }))}
          >
            🖌️ Restore
          </button>
        </div>

        {editing.activeTool !== 'none' && (
          <div className="control-group" style={{ flex: 1, minWidth: '200px' }}>
            <label className="control-label">Brush Size</label>
            <div className="range-with-value">
              <input
                type="range"
                min="5" max="150" step="5"
                value={editing.brushSize}
                onChange={(e) => setEditing(prev => ({ ...prev, brushSize: parseInt(e.target.value) }))}
                className="control-input"
              />
              <span className="range-value">{editing.brushSize}px</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualTouchupControls;
