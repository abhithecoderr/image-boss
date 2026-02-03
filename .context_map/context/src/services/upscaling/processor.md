# Context Map: upscaling/processor.js

## Purpose
Main-thread controller for the image upscaling service. Manages the lifecycle of a dedicated Real-ESRGAN worker, handles zero-copy transfer of image bitmaps, and orchestrates "Hot-Refinement" tasks for instant filter updates without re-running AI inference.

## Imports
- **worker.js**: Loaded as a dedicated Web Worker

## Dependencies
- **Used by**:
  - `main.js`: Primary interface for resolution enhancement and slider-driven refinement.
- **Uses**:
  - `upscaling/worker.js`: Handles tile-based ONNX inference and lightweight filter-pass refinement.

## Project Flow Connection
- **Data Intake**: Converts `sourceCanvas` to an `ImageBitmap` (L30) for efficient off-thread processing.
- **Worker Configuration**: Passes user-defined parameters (`scale`, `detailsIntensity`, `brightness`, `saturation`) to the worker.
- **Refinement Flow**: `refine` (L77-106) enables sub-100ms updates by triggering the worker's cached filter branch.
- **Result Finalization**: Reconstructs a high-resolution canvas (L41-45) and immediately calls `result.close()` (L46).

## File Code Structure

**`getWorker()`** (L11-16): Standard singleton provider for the global upscaling worker.

**`process(sourceCanvas, options, onProgress)`** (L25-73):
- **Transferable Logic** (L30, L71): Moves the image to the worker without copying.
- **Message Router** (L32-54): Tracks `progress`, `complete`, and `error` IPC types.

**`refine(options)`** (L77-106):
- **Lightweight Update**: Sends a `type: 'refine'` message to the worker.
- **Zero-Inference**: Resolves instantly using the worker's cached AI output.

## Code Details

**`async function process()`** (L25-73): Injects a `const bitmap = await createImageBitmap(resized)` call. Moves the reference to the worker via `postMessage`.

**`result.close()` call** (L46, L96): Essential for immediate RAM deallocation of the back-transferred `ImageBitmap` in both `process` and `refine` listeners.

**`patchSize: 128` parameter** (L68): Forces the worker to use optimal tile dimensions for WebGPU stability.
