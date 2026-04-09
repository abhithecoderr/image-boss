# Context Map: blur/processor.js


## 1. Purpose

The main-thread interface for the Face Blur service. It orchestrates non-blocking face detection using YOLOv10/v11 (YOLO26) via a web worker, manages model variant selection (Nano to XLarge), and provides "Re-Blur" functionality for instant UI feedback when the user adjusts blur intensity without re-running the AI detector.


## 2. Imports

- **Worker**:
  - Syntax: `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });`
  - Purpose: Initializes the dedicated inference thread using a standard ES Module worker to handle WebGPU/WASM tasks.


## 3. Dependencies

- **Used by**:
  - `useProcessor.js` (Primary service execution path).
  - `ControlPanel.jsx` (For model variant and intensity adjustments).

- **External APIs**:
  - **createImageBitmap**: Critical for zero-copy transfer of large images to the worker.


## 4. State Management

- **lastDetections (Variable)**:
  - Syntax: `let lastDetections = [];`
  - Purpose: Caches the bounding boxes and keypoints from the most recent AI pass to enable the "Re-Blur" optimization.

- **lastSourceBitmap (Variable)**:
  - Syntax: `let lastSourceBitmap = null;`
  - Purpose: Persists a clone of the source image in memory to allow for fast parameter tweaking without main-thread re-loading.


### 1. Initialization
- **Flow**: Checks if the worker is ready and matches the requested `variant`. If not, it triggers the `init` handshake.
- **Files Involved**:
  - `worker.js`: Handles the model weight loading and WebGPU device allocation.

### 2. Detection
- **Flow**: Sends the image to the Worker. The AI thread returns an array of specialized detection objects.
- **Files Involved**:
  - `worker.js`: Executes the YOLOpose inference phase.

### 3. Cashing
- **Flow**: Stores the detections and a clone of the original bitmap.

### 4. Synthesis
- **Flow**: The worker performs the elliptical blurring on the source bitmap and returns a new `ImageBitmap`.
- **Files Involved**:
  - `worker.js`: Renders the blurred subject masks using OffscreenCanvas.

### 5. Optimization
- **Flow**: When "Blur Intensity" is changed, `updateBlurTransform` bypasses detection and sends cached detections to the worker.
- **Files Involved**:
  - `worker.js`: Re-renders the blur without repeating the detect-phase ORT session.


## 6. Code Structure

- **init (Function)**:
  - Syntax: `export async function init(variant = 'nano', onProgress) { ... }`
  - Purpose: Singleton-style initialization.
  - Working: Ensures only one worker is active, handles the async message registration, and blocks execution until the worker signals 'ready'.

- **process (Function)**:
  - Syntax: `export async function process(source, options = {}, onProgress) { ... }`
  - Purpose: Complete pipeline execution (Detect + Blur).
  - Working: Prepares the image buffer, sends it to the worker, and awaits a 'complete' message. It updates the `lastDetections` cache upon success.

- **updateBlurTransform (Function)**:
  - Syntax: `export async function updateBlurTransform(options = {}) { ... }`
  - Purpose: The "Instant Feedback" engine.
  - Working: Sends the `lastSourceBitmap` and `lastDetections` back to the worker for a `reblur` command, skipping the computationally expensive 640x640 YOLO inference pass.


## 7. Points To Consider

- **The "Re-Blur" Invariant**: This service distinguishes between `detect` (AI) and `blur` (Rendering). `updateBlurTransform` is the key to the application's "Lush and Fluid" UX during slider movements.

- **Variant Trade-offs**: Nano models are ~5MB and suitable for slow hardware, while XLarge models (~100MB) provide significantly higher precision for small or profile faces.

- **Bitmap Management**: `lastSourceBitmap.close()` is called before creating a new one to prevent VRAM accumulation during long sessions.

- **Support for re-rendering**: The `process` function returns a `canvas` property which is actually a high-performance `ImageBitmap`, ready for direct rendering in the `Workspace`.
