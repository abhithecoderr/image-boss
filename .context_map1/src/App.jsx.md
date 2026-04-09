**Location:** /src/App.jsx


**Purpose:**

Acts as the layout organiser for the application, connecting the different components of Sidebar, Workspace and ControlPanel together.
Also manages the process button link with ControlPanel component. And workspace buttons like new image and download result


**State management:**

Accesses global state variables from useApp context. Uses currentService.id to check when to render chat vs normal workspace.


**Code Structure:**

*Imports*

*App Component*

```js
function App() {
  const { currentService, toast, resetWorkspace, resultCanvas } = useApp();
  const { process } = useProcessor();
```

  *Header*

 ```js
  return (
    <div id="app">
      <header id="nav">
        <div className="nav-brand">
          <span className="brand-icon">🚀</span>
          <span className="brand-text">Image Boss</span>
        </div>
      </header>
```

   *Main layout*

   ```js
   <div className="main-layout">
        <Sidebar />

        <main id="main">
          <div className="service-info">
            <h1>{currentService.name}</h1>
            <p>{currentService.description}</p>
          </div>

          {currentService.id === 'chat' ? (
            <ChatInterface />
          ) : (
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
          )}
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
```


