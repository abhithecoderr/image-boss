# Context Map: upscaling/worker.js


## 1. Purpose

The persistent background thread for the Real-ESRGAN super-resolution model. It implements a complex "Tile-based Upscaling" engine to handle any image resolution without exceeding browser VRAM limits. It also provides a high-speed "Hot Refinement" layer for GPU-accelerated post-processing and frequency separation.


## 2. Imports

- **onnxruntime-web**:
  - Syntax: `import * as ort from 'onnxruntime-web/webgpu';`
  - Purpose: High-performance ONNX execution engine with WebGPU-first strategy.


## 3. Dependencies

- **Used by**:
  - `processor.js` (The main-thread communicator).

- **External APIs**:
  - **WebGPU**: Primary hardware target.
  - **OffscreenCanvas**: Used for tile manipulation, I/O clamping, and frequency-separation compositing.


## 4. State Management

- **cachedAIResult (Variable)**:
  - Syntax: `let cachedAIResult = null;`
  - Purpose: Stores the raw 400% upscaled pixel buffer (as an `OffscreenCanvas`) to enable instant filter tweaking.

- **cachedOriginalBitmap (Variable)**:
  - Syntax: `let cachedOriginalBitmap = null;`
  - Purpose: Stores a copy of the high-res original for "Detail Restoration" math (High-Pass filtering).


### 1. Intake
- **Flow**: Downloads the ONNX model and weight file (.data) split from HuggingFace.

### 2. Tiling Strategy
- **Flow**: Divides the input image into 128x128 tiles with a 16px overlap (`STRIDE: 96px`).

### 3. Inference Loop
- **Flow**: For each tile: Clamps edges, generates RGB tensor, runs model (4x), and pastes back.
- **Files Involved**:
  - `onnxruntime-web`: Executes the Real-ESRGAN model on the WebGPU device.

### 4. Refinement
- **Flow**: Applies "GPU-Accelerated Unsharp Mask" by compositing the original image over the AI result.

### 5. Transfer
- **Flow**: Returns a final `ImageBitmap` to the main thread.
- **Files Involved**:
  - `processor.js`: Receives the high-res 4x result for final UI mounting.


## 6. Code Structure

- **applyFilters (Function)**:
  - Syntax: `async function applyFilters(aiCanvas, originalBitmap, params, progressCallback) { ... }`
  - Purpose: High-speed post-processing.
  - Working: Implements frequency separation via hardware filters (`brightness`, `saturate`) and high-pass texture restoration using the `overlay` composite operation.

- **onmessage (Handler)**:
  - Syntax: `self.onmessage = async ({ data }) => { ... };`
  - Purpose: Tiling and Lifecycle manager.
  - Working: Handles the logic split between `upscale` (heavy AI) and `refine` (light filters). It includes the outer loop for spatial tiling and the manual tensor reconstruction required for 4x output logic.


## 7. Points To Consider

- **The "Stretched Resize" Invariant**: For scales < 4x (Turbo mode), the image is downsized *before* tiling. This speeds up inference significantly for users who only want 1.5x or 2x results.

- **Tile Edge Clamping**: To prevent black lines at tile boundaries, the worker manually mirrors/clamps edge pixels (`tileCtx.drawImage(bitmap, ... sx, 0, ...)`) if a tile extends beyond the image bounds.

- **Memory Sanitization**: `cachedOriginalBitmap.close()` must be called whenever a new image arrives to prevent OOM in the browser's shared heap.

- **Frequency Separation Protocol**: The "Details" slider doesn't just sharpen pixels; it performs a synthetic high-pass restore using the original source data to put back "Natural Grain" that the AI might have smoothed away.
