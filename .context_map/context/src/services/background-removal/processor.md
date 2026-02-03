# Context Map: background-removal/processor.js

## Purpose
Main-thread orchestrator for the background removal service. Handles image preprocessing (resizing), zero-copy data transfer to the web worker, and manages the communication lifecycle for encoding, prediction, and refinement tasks.

## Imports
- **worker.js**: Dynamically loaded as a Web Worker
- **../../core/canvas-utils.js**: `resizeCanvas` - Performance optimization utility

## Dependencies
- **Used by**:
  - `main.js`: Primary interface for processing images and refining results
- **Uses**:
  - `background-removal/worker.js`: Executes heavy AI model inference

## Project Flow Connection
- **In-take**: `process` downscales images to <2048px (L91) before sending to worker to prevent memory overhead.
- **Worker Management**: `getWorker` (L13-18) ensures a singleton worker instance.
- **State Updates**: `messageHandler` (L98-114) throttles progress updates to 100ms (L11, L103) to keep the UI responsive.
- **Output Generation**: `createResultCanvas` (L182-198) converts raw RGBA buffers back into usable `HTMLCanvasElement` nodes.

## File Code Structure

**`getWorker()`** (L13-18): Singleton initialization for the service worker.

**`encode(sourceCanvas, onProgress)`** (L23-48): Logic for sending image bitmaps to worker for memory-intensive encoding (legacy/SAM 2 preparation).

**`predict(points, labels)`** (L53-70): Sends selection dots/rectangles to worker and resolves with a processed result.

**`predictBox(x1, y1, x2, y2)`** (L75-80): Wrapper for `predict` that maps a bounding box to two labeled points (2=top-left, 3=bottom-right).

**`process(sourceCanvas, options, onProgress)`** (L86-132): Primary entry point. Handles resizing, bitmap creation, and model execution (MODNet, BiRefNet, etc.).

**`refine(options)`** (L137-160): Light-weight utility to update mask parameters (threshold, feathering) without re-running inference.

**`clear(clearModels)`** (L165-177): Explicit memory management to flush worker state or cached models.

**`createResultCanvas(result)`** (L182-198): Internal utility to rebuild a canvas from `Uint8ClampedArray` pixel data.

## Code Details

**`async function process()`** (L86-132): Injects a `const bitmap = await createImageBitmap(resized)` call (L128) and passes it as a `Transferable` in the `postMessage` call (L130) to achieve zero-copy performance.

**`function messageHandler()`** (L98-114): Throttling logic using `if (Date.now() - lastProgress < 100)` (L103). Prevents high-frequency worker callbacks from saturating the main thread’s frame budget.

**`function createResultCanvas()`** (L182-198): Reconstruction utility. Uses `new ImageData(clampedArray, width, height)` (L194) and `ctx.putImageData` (L195) to build an `HTMLCanvasElement` from raw worker buffers.

**`if (!Number.isFinite(width))` check** (L185-186): Safety guard within the rendering logic to prevent invalid canvas allocation if worker results are malformed.
