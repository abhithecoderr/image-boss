# Context Map: background-removal/processor.js

## Purpose
Main-thread orchestrator for the background removal service. Handles image preprocessing (resizing), zero-copy data transfer to the web worker, and manages the communication lifecycle. Performs high-performance mask compositing using GPU-accelerated scaling in the main thread.

## Imports
- **worker.js**: Dynamically loaded as a Web Worker
- **../../core/canvas-utils.js**: `resizeCanvas` - Performance optimization utility

## Dependencies
- **Used by**:
  - `main.js`: Primary interface for processing images and refining results
- **Uses**:
  - `background-removal/worker.js`: Executes heavy AI model inference

## Project Flow Connection
- **In-take**: `process` downscales images to <2048px (L92) before sending to worker to prevent memory overhead.
- **Worker Management**: `getWorker` (L14-19) ensures a singleton worker instance.
- **State Updates**: `messageHandler` (L101-117) throttles progress updates to 100ms (L12, L106) to keep the UI responsive.
- **GPU Compositing**: `applyMaskToCanvas` (L183-222) leverages the browser's GPU to scale low-res masks and apply them via `destination-in`.

## File Code Structure

**`getWorker()`** (L14-19): Singleton initialization for the service worker.

**`encode(sourceCanvas, onProgress)`** (L24-49): Logic for sending image bitmaps to worker for memory-intensive encoding.

**`predict(points, labels)`** (L54-72): Sends selection dots to worker and applies the resulting mask to `lastProcessedCanvas`.

**`predictBox(x1, y1, x2, y2)`** (L77-82): Wrapper for `predict` that maps a bounding box to two labeled points.

**`process(sourceCanvas, options, onProgress)`** (L88-135): Primary entry point. Handles resizing, stores `lastProcessedCanvas` (L93), and initiates model execution.

**`refine(options)`** (L140-163): Light-weight utility to update mask parameters. Resolves with a newly composited canvas using the cached `lastProcessedCanvas`.

**`clear(clearModels)`** (L168-180): Explicit memory管理 to flush worker state and reset `lastProcessedCanvas`.

**`applyMaskToCanvas(sourceCanvas, maskResult)`** (L183-222): High-performance compositor. Converts 1-channel mask to alpha, then uses `ctx.drawImage` (L217) to scale and apply to source.

## Code Details

**`lastProcessedCanvas` variable** (L11): Persistence layer for refinement. Holds the source image used as the base for all mask adjustments.

**`ctx.globalCompositeOperation = 'destination-in'`** (L216): The core of the GPU-scaling tactic. This applies the mask by discarding pixels outside the alpha boundary without a manual CPU pixel loop.

**`const maskData = new Uint8ClampedArray(maskWidth * maskHeight * 4)`** (L200): Preparation of the low-res mask for canvas upload. Only one upload to the GPU is required per refinement cycle.
