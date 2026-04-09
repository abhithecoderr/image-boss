# Context Map: upscaling/processor.js


## 1. Purpose

The main-thread interface for the AI Super-Resolution service. It manages a dedicated tiling worker for high-performance upscaling (Real-ESRGAN), handles the conversion between `HTMLCanvasElement` and `ImageBitmap`, and provides a `refine` method for instant UI feedback on post-processing filters.


## 2. Imports

- **Worker**:
  - Syntax: `import Worker from './worker.js?worker';`
  - Purpose: Initializes the tile-based upscaling thread.


## 3. Dependencies

- **Used by**:
  - `useProcessor.js` (Invoked when the 'upscaling' service is selected).

- **External APIs**:
  - **createImageBitmap**: Zero-copy transfer of high-res source images.


## 4. State Management

- **worker (Variable)**:
  - Syntax: `let worker = null;`
  - Purpose: Singleton worker reference.


### 1. Ingestation
- **Flow**: Captures the source canvas and generates an `ImageBitmap`.
- **Files Involved**:
  - `canvas-utils.js`: Converts the HTML5 Canvas state into a transferable bitmap buffer.

### 2. Inference Handshake
- **Flow**: Posts the bitmap and scale options to the Upscaling Worker.
- **Files Involved**:
  - `worker.js`: Receives the source pixels to initiate the tiling loop.

### 3. Tile Execution
- **Flow**: The worker processes the image in 128px tiles (managed by the worker).
- **Files Involved**:
  - `worker.js`: Orchestrates the spatial division and sequential AI upscaling.

### 4. Resolution
- **Flow**: Receives a single large `ImageBitmap` (4x the original) from the worker.

### 5. Reification
- **Flow**: Creates a result canvas of the new dimensions and renders the bitmap into it.

### 6. Refinement
- **Flow**: When the user adjusts "Details" or "Brightness", the `refine` function signals the worker to apply GPU filters to its cached result.
- **Files Involved**:
  - `worker.js`: Applies fast OffscreenCanvas frequency-separation filters.


## 6. Code Structure

- **process (Function)**:
  - Syntax: `export async function process(sourceCanvas, options = {}, onProgress) { ... }`
  - Purpose: The primary async orchestrator.
  - Working: Manages the `messageHandler` lifecycle. It performs the Canvas-to-Bitmap conversion, transmits the data, and then performs the reverse Bitmap-to-Canvas conversion once the 400% upscaled result arrives.

- **refine (Function)**:
  - Syntax: `export async function refine(options = {}) { ... }`
  - Purpose: The "Instant Tweaking" bridge.
  - Working: Sends parameter updates to the worker without re-running the AI model. This allows for near-instant updates of high-pass detail enhancement and color grading.


## 7. Points To Consider

- **The "Scale Factor" Invariant**: The worker always upscales by 4x. If the user requests 2x, the processor receives the 4x result and performs a final high-quality downscale to the target dimensions on the main thread.

- **Transferable Hygiene**: Bitmaps are transferred both *to* and *from* the worker. `result.close()` is called immediately after drawing to the main canvas to release GPU memory.

- **Manual Listener Management**: The `messageHandler` is added and removed for every `process` call to prevent listener leaks in long-running sessions.

- **Feedback Strategy**: The `onProgress` callback receives granular tile-based progress (e.g., "Processed 45/96 tiles") to keep the user engaged during the long inference pass.
