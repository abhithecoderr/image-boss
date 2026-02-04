# Context Map: blur/processor.js

## 1. Purpose
Management layer for the face blurring service. Orchestrates the YOLO26 worker lifecycle, manages model variants (Nano to XLarge), and provides the API for detection and visual modification. Bridges the gap between raw AI pose coordinates and the browser's Canvas API.

## 2. Imports
- **worker.js**: The background thread implementation.

## 3. Dependencies
- **Uses**:
  - [worker.js](file:///c:/projects/bg/my-ai-app/src/services/blur/worker.js): Background AI thread.
- **Used by**:
  - `main.js`: Primary UI orchestrator.

## 4. State Management

- **worker (Variable/Worker)**
  - **Syntax**: `let worker = null`
  - **Purpose**: Singleton reference for the face-blur thread.

- **isReady (Variable/Boolean)**
  - **Syntax**: `let isReady = false`
  - **Purpose**: Tracks model load state to prevent premature `process()` calls.

- **pendingInit (Variable/Promise)**
  - **Syntax**: `let pendingInit = null`
  - **Purpose**: Initialization mutex. Ensures that multiple calls to `init()` during a rapid service switch do not spawn redundant worker instances or trigger multiple driver loads.

- **lastDetections (Variable/Array)**
  - **Syntax**: `let lastDetections = []`
  - **Purpose**: "Hot-Refinement" Cache. Stores the results of the last `detectFaces` run, allowing for instantaneous blur radius/shape adjustments (`updateBlurTransform`) without re-running the AI.

## 5. Project Flow
1. **Bootstrap**: `init()` is called to spawn the module worker and load the selected YOLO variant (default: 'nano').
2. **Analysis Stage**: `detectFaces()` transfers the image buffer to the worker. The worker returns raw 51-keypoint pose coordinates.
3. **Execution Stage**: `process()` combines detection with visual modification. It receives the blurred pixels from the worker and renders them back to a canvas.
4. **Interaction Loop**: If the user adjusts the blur radius or feathering, `updateBlurTransform()` is called. This sends only the cached detections and the new parameters back to the worker, bypassing the AI inference entirely for 60fps responsiveness.
5. **Teardown**: `dispose()` gracefully terminates the worker and clears GPU memory.

## 6. Code Structure

- **`MODEL_VARIANTS` (Object)**
  - **Syntax**: `export const MODEL_VARIANTS = { ... }`
  - **Purpose**: Defines the available model scales and their memory profiles.

- **`init` (Function)**
  - **Name (Type)**: init (Lifecycle)
  - **Syntax**: `export async function init(variant = 'nano', onProgress)`
  - **Working**: Implements the **Singleton Init Mutex**. It creates a persistent Promise (`pendingInit`) that subsequent callers wait on, ensuring a synchronized bootstrap.

- **`detectFaces` (Function)**
  - **Name (Type)**: detectFaces (Analysis)
  - **Syntax**: `export async function detectFaces(source, options = {}, onProgress)`
  - **Working**: Performs a one-way analysis. Returns only the structured detection metadata (boxes and keypoints).

- **`process` (Function)**
  - **Name (Type)**: process (Primary Entry Point)
  - **Syntax**: `export async function process(source, options = {}, onProgress)`
  - **Working**: The main tool orchestration logic. Converts the source image to a 32-bit pixel array for worker transfer and returns the final blurred result.

- **`updateBlurTransform` (Function)**
  - **Name (Type)**: updateBlurTransform (Refinement)
  - **Syntax**: `export async function updateBlurTransform(options = {})`
  - **Working**: The "Fast Path". Re-uses `lastImageData` and `lastDetections` to trigger a non-AI visual pass in the worker.

- **`getImageData` (Function)**
  - **Name (Type)**: getImageData (Internal Utility)
  - **Syntax**: `async function getImageData(source)`
  - **Purpose**: Extracts raw pixel buffers from Canvases, Bitmaps, or Image elements.

- **`dispose` (Function)**
  - **Name (Type)**: dispose (Cleanup)
  - **Syntax**: `export async function dispose()`

## 7. Points To Consider
- **Initialization State**: Consider checking `isReady` (L76) before calling `detect` or `process` to prevent race conditions during async model loading.
- **Memory Pressure**: Note that 4K `ImageData` transfers are large; consider resizing images via `canvas-utils` (L77) before passing them to the worker if performance degrades.
- **Variant Sync**: Consider keeping `currentVariant` (L78) synchronized between the processor and worker to prevent parameter mismatches during model switches.
