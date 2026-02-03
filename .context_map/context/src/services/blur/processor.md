# Context Map: blur/processor.js

## Purpose
Main-thread controller for the Face Blur service. Manages the lifecycle of a dedicated YOLO26-pose worker, handles multi-variant model initialization (Nano to XLarge), and coordinates face detection and surgical blurring workflows.

## Imports
- **worker.js**: Loaded as a module-style Web Worker (L47)
- **MODEL_VARIANTS**: Definition object for speed/accuracy trade-offs

## Dependencies
- **Used by**:
  - `main.js`: Triggers face detection and blurring based on UI controls
- **Uses**:
  - `blur/worker.js`: Runs YOLOpose inference and localized blur logic

## Project Flow Connection
- **Initial Setup**: `init` (L34-80) handles worker instantiation and model variant switching.
- **Workflow Routing**: Supports both isolation detection (`detectFaces`) and full modification (`process`).
- **Data Conversion**: `getImageData` (L188-222) acts as a polyfill to extract raw pixel arrays from `HTMLCanvasElement`, `ImageBitmap`, or `HTMLImageElement`.
- **Result Reintegration**: `process` (L134-183) reconstructs a visible canvas from the worker’s raw buffer result (L157-162).

## File Code Structure

**`MODEL_VARIANTS`** (L20-26): Metadata for UI menus, describing file sizes and use-cases.

**`init(variant, onProgress)`** (L28-80): Singleton-pattern initializer with re-entrancy protection via `pendingInit` promise (L40).

**`detectFaces(source, options, onProgress)`** (L82-125): IPC wrapper that resolves with a list of bounding boxes and keypoints.

**Cache State** (L126-131): Maintains `lastDetections`, `lastImageData`, `lastWidth`, and `lastHeight` for interactive refinement.

**`process(source, options, onProgress)`** (L132-192): Primary transformation function. Communicates with worker to execute detection + surgical blur. Populate cache state on success.

**`updateBlurTransform(options)`** (L194-233): Fast-path re-rendering that bypasses detection. Uses cached data to update blur geometry (Radius, Strength, Feathering).

**`getImageData(source)`** (L235-272): Unified extractor for `Uint8ClampedArray` data. Uses internal temporary canvases for translation.

**`dispose()`** (L274-295): Graceful teardown of the worker and internal pointers.

## Code Details

**`async function init()`** (L34-80): Re-entrancy guard using `if (pendingInit) return pendingInit`. Ensures only one worker is spawned by caching the initialization `Promise`.

**`Uint8ClampedArray` wrapper** (L161): Executes inside the `process` branch. Reconstructs a `new ImageData` object from the worker's `ArrayBuffer` without intermediate memory copies.

**`switch (message.type)` block** (L54-70, L104-116, L149-174): Unified IPC router. Manages `progress` updates and `complete` / `error` handlers for detection and blurring tasks.

**`worker.terminate()` call** (L234): Executes inside `function dispose()`. Essential for releasing WebGPU compute pipelines and flushing the background module's RAM.
