# Context Map: upscaling/processor.js

## Purpose
Main-thread controller for the image upscaling service. Manages the lifecycle of a dedicated Real-ESRGAN worker, handles zero-copy transfer of image bitmaps, and implements post-inference canvas reconstruction with automatic memory management for transferable objects.

## Imports
- **worker.js**: Loaded as a dedicated Web Worker (L6)

## Dependencies
- **Used by**:
  - `main.js`: Primary interface for resolution enhancement and detail sharpening
- **Uses**:
  - `upscaling/worker.js`: Handles tile-based ONNX inference and frequency-separation filtering

## Project Flow Connection
- **Data Intake**: Converts `sourceCanvas` to an `ImageBitmap` (L29) for efficient off-thread processing.
- **Worker Configuration**: Passes user-defined parameters (`scale`, `detailsIntensity`, `brightness`, `saturation`) and hard-coded tiling constants (`patchSize`, `padding`) to the worker (L62-68).
- **Result Finalization**: Reconstructs a high-resolution canvas (L40-44) and immediately calls `result.close()` (L45) to release transferable GPU memory.

## File Code Structure

**`getWorker()`** (L10-15): Standard singleton provider for the global upscaling worker.

**`process(sourceCanvas, options, onProgress)`** (L24-72):
- **Transferable Logic** (L29, L70): Moves the image to the worker without copying.
- **Message Router** (L31-53): Tracks standard `progress`, `complete`, and `error` IPC types.
- **UI Feedback** (L47): Reports the final dimensions of the upscaled result to the status bar.

## Code Details

**`async function process()`** (L24-72): Injects a `const bitmap = await createImageBitmap(sourceCanvas)` call (L29). Moves the reference to the worker via `postMessage(payload, [payload.image])` (L70) to ensure zero-copy logic.

**`result.close()` call** (L45): Executes inside the `complete` branch of the `onmessage` listener (L31-53). Essential for immediate RAM deallocation of the back-transferred `ImageBitmap`.

**`patchSize: 64` parameter** (L67): Hardcoded within the `process` branch. Prevents ONNX runtime shader overflows by forcing the worker to use manageable tile dimensions.
