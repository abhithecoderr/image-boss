# Context Map: background-removal/processor.js


## 1. Purpose

The main-thread orchestrator for the Background Removal service. It manages the lifecycle of a dedicated background-removal worker, handles image resizing to model-native resolutions (e.g., 768px for InSPyReNet), and performs the final GPU-accelerated compositing of the AI-generated mask onto the original source image.


## 2. Imports

- **Worker**:
  - Syntax: `import Worker from './worker.js?worker';`
  - Purpose: Imports the specialized AI worker thread via Vite's `?worker` constructor.

- **resizeCanvas**:
  - Syntax: `import { resizeCanvas } from '../../core/canvas-utils.js';`
  - Purpose: Downscales large source images to the native input resolution of the selected AI model to minimize WebGPU VRAM usage.


## 3. Dependencies

- **Used by**:
  - `useProcessor.js` (Invoked via the dynamic `import()` bridge).

- **External APIs**:
  - **createImageBitmap**: Used for zero-copy transfer of the processed canvas to the Worker.
  - **Canvas API (Compositing)**: Specifically `destination-in` for mask application.


## 4. State Management

- **worker (Variable)**:
  - Syntax: `let worker = null;`
  - Purpose: A singleton reference to the persistent web worker.

- **cachedResultCanvas (Variable)**:
  - Syntax: `let cachedResultCanvas = null;`
  - Purpose: Prevents garbage collection overhead by reusing the same result buffer for repeated processing runs.


## 5. Project Flow

### 1. Resolution Matching
- **Flow**: Determines the optimal `targetSize` (512, 768, 384) based on the specific sub-model selected (MODNet, InSPyReNet, BiRefNet).

### 2. Ingestion Prep
- **Flow**: Resizes the input and generates an `ImageBitmap`.
- **Files Involved**:
  - `canvas-utils.js`: Downscales large source images to model-native resolutions.

### 3. Inference Hand-off
- **Flow**: Posts the bitmap and model metadata to the Worker.
- **Files Involved**:
  - `worker.js`: Receives the raw pixel data and model configuration for isolated inference.

### 4. Progress Monitoring
- **Flow**: Throttled incoming progress messages from the worker to 100ms intervals to keep the React UI responsive.

### 5. Synthesis
- **Flow**: Upon receiving the 1-channel mask from the worker, it invokes `applyMaskToCanvas` to create the final transparent PNG result.


## 6. Code Structure

- **getWorker (Function)**:
  - Syntax: `function getWorker() { ... }`
  - Purpose: Singleton worker accessor.
  - Working: Ensures only one `Worker` instance is created per session, lazy-initializing it upon the first process request.

- **process (Function)**:
  - Syntax: `export async function process(sourceCanvas, options = {}, onProgress) { ... }`
  - Purpose: The primary service entry point.
  - Working: Handles the async handshake with the worker. It sets up transient event listeners for `message` and `error`, performs the downscaling, and wraps the entire worker lifecycle in a Promise that resolves with the final composited canvas.

- **applyMaskToCanvas (Function)**:
  - Syntax: `function applyMaskToCanvas(sourceCanvas, maskResult) { ... }`
  - Purpose: High-fidelity image masking.
  - Working: Clears the cached result canvas, draws the original image, and then applies the AI mask using a `destination-in` composite operation. Crucially, it applies a `blur(1.2px)` filter to the mask during drawing to achieve professional-grade feathered edges.


## 7. Points To Consider

- **Zero-Copy Invariant**: Bitmaps sent to the worker are included in the transfer list (`[bitmap]`). This means the main thread loses access to that specific memory block immediately, saving the cost of a full pixel copy.

- **The "Model Sizes" Registry**: Target resolutions (MODNet: 512, InSPyReNet: 768) are hardcoded here to match the internal requirements of the `.onnx` model files. Changing these without updating the weights will cause the AI to return garbage.

- **Feathering Strategy**: Professional "soft" edges are achieved not in the AI model, but during the final main-thread compositing via the `filter = 'blur(1.2px)'` call. This hides pixelation artifacts from the model's lower internal resolution.

- **Bitmap Hygiene**: `maskBitmap.close()` is called immediately after use. This is critical for preventing GPU memory leaks during long editing sessions.
