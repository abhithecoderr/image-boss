import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import ControlPanel from './components/ControlPanel';

import { useApp } from './context/AppContext';
import { useProcessor } from './hooks/useProcessor';

function App() {
  const { currentService, toast, resetWorkspace, resultCanvas } = useApp();
  const { process } = useProcessor();

  return (
    <div id="app">
      <header id="nav">
        <div className="nav-brand">
          <span className="brand-icon">🚀</span>
          <span className="brand-text">Image Boss</span>
        </div>
      </header>

      <div className="main-layout">
        <Sidebar />

        <main id="main">
          <div className="service-info">
            <h1>{currentService.name}</h1>
            <p>{currentService.description}</p>
          </div>

          <>
              <Workspace />
              <ControlPanel onProcess={(options) => process(options)} />
              <div className="actions actions-row">
                 <button className="btn btn-secondary" onClick={resetWorkspace}>New Image</button>
                 {resultCanvas && (
                   <button
                     className="btn btn-primary"
                     onClick={() => {
                       const filename = `result_${Date.now()}.png`;
                       import('./core/canvas-utils').then(m => m.downloadCanvas(resultCanvas, filename));
                     }}
                   >
                     📥 Download Result
                   </button>
                 )}
              </div>
            </>
        </main>
      </div>

      {toast && (
        <div className={`toast show toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
