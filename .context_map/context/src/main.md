# Context Map: main.js

## 1. Purpose
Main application controller for Image Boss. Orchestrates the user interface, service navigation, image processing workflows, and high-level feature coordination. Acts as a Hub-and-Spoke orchestrator connecting user events with specialized workers.

## 2. Imports
- **config.js**: `SERVICES`, `SERVICE_ORDER` - Registry of available AI tools and UI ordering.
- **core/canvas-utils.js**: `loadImage`, `imageToCanvas`, etc. - Fundamental pixel tools.
- **core/ui-utils.js**: `showToast`, `updateProgress` - User feedback and status reporting.

## 3. Dependencies
- **Uses**:
  - All sub-processors in `src/services/*/processor.js`.
  - Core utility modules in `src/core/`.
  - DOM APIs for event handling and workspace rendering.
- **Used by**:
  - Entry point - Bootstrapped by `init()` on page load within `index.html`.

## 4. State Management

- **state (Object)**
  - **Syntax**: `const state = { ... }`
  - **Purpose**: Centralized application state.
  - **Namespace Details**:
    - `currentService`: Active service config from `config.js`.
    - `originalImage`/`originalCanvas`: Reference to the intake source.
    - `resultCanvas`: Pointer to the final processed output.
    - `processor`: Instance of the dynamically loaded service processor.
    - `isProcessing`: Mutex flag to block concurrent AI tasks.
    - `editing`: Sub-state for manual brush tools (masking).
    - `comparison`: Sub-state for before/after slider position.
    - `samPoints`: Array of coordinates for interactive segmenters.

- **elements (Object)**
  - **Syntax**: `const elements = { ... }`
  - **Purpose**: Static and dynamic DOM element cache to minimize `document.getElementById` calls.

## 5. Project Flow
1. **Bootstrap**: `init()` triggers navigation rendering and sets up global listeners (drag-and-drop, service switching).
2. **Intake Pipeline**: User uploads a file; `handleFile` validates the type, loads the image via `canvas-utils`, and initializes the side-by-side workspace.
3. **Service Logic**:
   - `selectService` triggers a UI layout refresh based on `config.js`.
   - `loadProcessor` performs a dynamic `import()` of the required service code.
4. **Processing Loop**: `processImage` gathers UI parameters, invokes the processor's async `process()` method, and channels progress callbacks to the status bar.
5. **Synthesis & Feedback**: The processor returns a result buffer; `updateResultDisplay` synchronizes the UI, handles specific display modes (like captions or grids), and enables the download interface.
6. **Export**: `downloadResult` applies service-specific file naming and quality optimizations before triggering the browser's download prompt.

## 6. Code Structure

- **`debounce` (Function)**
  - **Syntax**: `function debounce(func, timeout = 300)`
  - **Purpose**: Limits the execution rate of a function.
  - **Working**: Essential for high-frequency events like window resizing or slider movements to prevent UI lag.

- **`state` Object (Declaration)**
  - **Syntax**: `const state = { ... }`
  - **Purpose**: Global runtime truth. [Refer to Section 4 for details]

- **`elements` Object (Declaration)**
  - **Syntax**: `const elements = { ... }`
  - **Purpose**: DOM Reference collection.

- **`init` (Function)**
  - **Syntax**: `async function init()`
  - **Purpose**: Application entry point.
  - **Working**: Triggers sequential setup of Navigation, SAM Overlays, and Event Listeners. Selects the default service from `SERVICE_ORDER`.

- **`createSAMOverlay` (Function)**
  - **Syntax**: `function createSAMOverlay()`
  - **Purpose**: Creates the interactive coordinate-capture layer for object segmentation.
  - **Working**: Injects a transparent `div` over the source canvas that maps clicks to normalized 0-1 coordinates for the AI.

- **`renderNavigation` (Function)**
  - **Syntax**: `function renderNavigation()`
  - **Purpose**: Dynamically builds the sidebar menu from `config.js`.

- **`setupComparisonSlider` (Function)**
  - **Syntax**: `function setupComparisonSlider()`
  - **Purpose**: Implements the visual before/after comparison tool for Upscaling.
  - **Working**: Uses a `clip-path: inset(...)` technique on an overlaying canvas. This allows the GPU to handle the split-view reveal with zero recalculation lag.

- **`selectService` (Function)**
  - **Syntax**: `async function selectService(serviceId)`
  - **Purpose**: Routes the application to a new functional mode.
  - **Working**: Performs UI cleanup, toggles active nav states, and releases memory from previous processors via optional `.dispose()` calls.

- **`renderControls` (Function)**
  - **Syntax**: `function renderControls(serviceId)`
  - **Purpose**: Generates dynamic HTML control panels (sliders, dropdowns) for the active service.
  - **Working**: Uses a large switch statement to inject service-specific templates. Implements debounced refinement listeners for all sliders to provide real-time feedback.

- **`handleFile` (Function)**
  - **Syntax**: `async function handleFile(file)`
  - **Purpose**: The main data intake handler.
  - **Working**: Performs image smoothing, resizing (limit 2048px), and initial rendering to the source canvas.

- **`processImage` (Function)**
  - **Syntax**: `async function processImage()`
  - **Purpose**: Orchestrates the heavy AI processing lifecycle.
  - **Working**: Sets the `isProcessing` flag, lazy-loads the processor module, and awaits the service's `process` method. Routes results to either the result canvas or specialized text containers (for captions).

- **`downloadResult` (Function)**
  - **Syntax**: `async function downloadResult()`
  - **Purpose**: Final output handler.
  - **Working**: Uses a `suffixMap` to generate accurate filenames based on the service used. Implements iterative quality optimization to stay within user-defined file size limits.

- **`updateResultDisplay` (Function)**
  - **Syntax**: `function updateResultDisplay()`
  - **Purpose**: The UI-to-State synchronizer.
  - **Working**: Toggles visibility between placeholders and results. Handles specialized rendering for grids, layers, and text containers.

## 7. Points To Consider
- **Template Safety**: Consider wrapping case blocks in `renderControls` with `{}` (L90) to ensure variables like `toolBtns` are correctly scoped and avoid redeclaration errors.
- **Concurrency Control**: Note that `processImage` (L100) should be guarded by an `isProcessing` flag to prevent GPU command buffer exhaustion.
- **Service Disposal**: Consider explicitly calling `processor.dispose()` (L85) when switching away from heavy models to ensure VRAM is cleared for the next service.
- **Normalized Coordinates**: Note that `samOverlay` captures should be normalized to 0-1 (L71) before worker transfer to maintain resolution independence.
