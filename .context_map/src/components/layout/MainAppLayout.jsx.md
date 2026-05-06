Layout organiser for the application that renders the header, sidebar, workspace, control panel and other stuff as per the mode selected (single, batch, workflow)

Code Structure

*Imports*

*Main component*

*useEffect to handle serviceId from dynamic url*

*Navbar, sidebar and service title rendering*

```js
return (
    <div id="main-app-container">
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
```
----------------------------------------------------------------------

*Workflow ui and batch object passing to Workspace component*

```js
<>
            {mode === OPERATION_MODE.WORKFLOW && (
              <WorkflowBuilder
                workflow={engine}
                onProcess={handleProcess}
              />
            )}

            <Workspace
              batch={
                mode === OPERATION_MODE.WORKFLOW
                  ? { ...engine, mode: "batch" }
                  : engine
              }
            />
```

----------------------------------------------------------------------


*ControlPanel and New Image button rendering*

```js
{mode !== OPERATION_MODE.WORKFLOW && (
              <ControlPanel />
            )}

            <div className="actions actions-row">
              <button
                className="btn btn-secondary"
                onClick={handleReset}
              >
                New Image
              </button>
```

--------------------------------------------------------------------


*Conditional download button rendering based on mode single or batch*

```js
{mode !== OPERATION_MODE.SINGLE ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={engine.downloadSelected}
                    disabled={engine.selectedIds.size === 0}
                  >
                    📥 Download Selected (
                    {engine.selectedIds.size})
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={engine.downloadAll}
                    disabled={engine.doneCount === 0}
                  >
                    📥 Download All
                  </button>
                </>
              ) : (
                resultCanvas && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const { filename, mimeType } = getDownloadMetadata(null, currentService.id, resultCanvas);
                      import("../../core/canvas-utils").then((m) =>
                        m.downloadCanvas(resultCanvas, filename, mimeType),
                      );
                    }}
                  >
                    📥 Download Result
                  </button>
                )
              )}
            </div>
          </>
        </main>
      </div>
```


