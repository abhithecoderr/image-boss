# Context Map: background-removal/processor.js

## 1. Purpose
Management layer for the background removal service. Handles image preprocessing (resizing), worker communication lifecycle, and the final high-resolution mask composition. Bridges the gap between raw AI output and the browser's DOM canvas.

## 2. Imports
- **worker.js?worker**: The background thread implementation.
- **../../core/canvas-utils.js**: `resizeCanvas` - used to cap image dimensions before worker transfer.

## 3. Dependencies
- **Uses**:
  - [worker.js](file:///c:/projects/bg/my-ai-app/src/services/background-removal/worker.js): Background AI implementation.
- **Used by**:
  - `main.js`: Primary orchestrator for the application UI.

## 4. State Management

- **worker (Variable/Worker)**
  - **Syntax**: `let worker = null`
  - **Purpose**: Lazy-loaded singleton for the background removal thread.

- **lastProcessedCanvas (Variable/Canvas)**
  - **Syntax**: `let lastProcessedCanvas = null`
  - **Purpose**: Stores the downsized original image (max 2048px) to serve as a reference for mask alignment.

- **mask buffers (Variable/Various)**
  - **Syntax**: `let maskCanvas = null; let maskData32 = null;`
  - **Purpose**: Reusable canvas and pixel buffers for result composition, minimizing garbage collection spikes.

## 5. Project Flow
1. **Intake**: Receives `sourceCanvas` from `main.js`.
2. **Preprocessing**: Downsizes the image to 2048px using `resizeCanvas` to stay within browser memory safety limits.
3. **Delegation**: Creates a zero-copy `ImageBitmap` and transfers it to the worker along with service parameters.
4. **Monitoring**: Listens for `progress` events to update the global status bar.
5. **Synthesis (Main Thread)**:
   - Receives the 1-channel mask buffer from the worker.
   - Converts the single-channel data into a full RGBA mask canvas.
   - Applies the mask to the original image using `destination-in` composite mode.
6. **Return**: Returns the finished result canvas back to the main UI orchestrator.

## 6. Code Structure

- **`getWorker` (Function)**
  - **Name (Type)**: getWorker (Singleton Helper)
  - **Syntax**: `function getWorker()`

- **`process` (Function)**
  - **Name (Type)**: process (Primary Entry Point)
  - **Syntax**: `export async function process(sourceCanvas, options = {}, onProgress)`
  - **Working**: The main orchestration logic. Orchestrates the resize → bitmap creation → worker postMessage loop. Returns a Promise that resolves to the masked result.

- **`refine` (Function)**
  - **Name (Type)**: refine (Lightweight Pass)
  - **Syntax**: `export async function refine(options = {})`
  - **Working**: Sends a `refine` command to the worker. This bypasses the heavy AI pass and uses cached mask data for sub-10ms UI updates.

- **`applyMaskToCanvas` (Function)**
  - **Name (Type)**: applyMaskToCanvas (Composition Core)
  - **Syntax**: `function applyMaskToCanvas(sourceCanvas, maskResult)`
  - **Purpose**: Blends the AI mask with the source image.
  - **Working**: Implements **Low-Res GPU Scaling Strategy**. By creating a mask at a lower resolution (e.g. 1024px) and drawing it over the source using `destination-in`, the browser's GPU performs high-quality interpolation automatically. This saves massive amounts of CPU time compared to pixel-wise blending on the full image.

## 7. Points To Consider
- **Composite Mode**: Consider using `destination-in` (L64) for the final blend because it preserves source pixels while efficiently applying the alpha mask.
- **32-Bit Pixel Buffer Performance**: Note that using `Uint32Array` (L65) for alpha manipulation is often faster than `Uint8Array` because it allows for single bit-shift operations per pixel.
- **Resource Cleanup**: Consider calling the `clear()` method when switching between different AI services to proactively release model memory in the worker thread.
