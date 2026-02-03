# Context Map: captioning/processor.js

## Purpose
Main-thread interface for the Florence-2 image captioning service. Manages a background worker for running the vision-language model and implements a custom Canvas overlay system to render generated text directly onto the image result.

## Imports
- **worker.js**: Loaded as a dedicated Web Worker (L6)

## Dependencies
- **Used by**:
  - `main.js`: Main UI component for generating image descriptions
- **Uses**:
  - `captioning/worker.js`: Handles heavy image-to-text inference

## Project Flow Connection
- **In-take**: Uses `createImageBitmap` (L31) for zero-copy memory transfer to the worker.
- **IPC Payload**: Passes `modelId` and `task` (e.g. `<MORE_DETAILED_CAPTION>`) to the worker (L59).
- **Rendering**: `createCaptionOverlay` (L72-119) expands the canvas and draws a custom text bar at the bottom.
- **Data Persistence**: Stores the raw caption in `resultCanvas.dataset.caption` (L116) for easier copying.

## File Code Structure

**`getWorker()`** (L10-15): Singleton worker instance provider.

**`process(sourceCanvas, options, onProgress)`** (L24-68): Main async entry point.
- **Zero-Copy Transfer**: Invokes `createImageBitmap` and transfers the bitmap to the worker context.
- **Result Return**: Resolves with `{ canvas, caption }` (L49) to support both UI display and downloads.

**`createCaptionOverlay(sourceCanvas, caption)`** (L72-119):
- **Typography**: Uses **24px Inter Bold** (L76).
- **Dynamic Layout**: Calculates lines via `ctx.measureText` (L84-96) and computes `bottomBarHeight` dynamically (L97-101) based on text length.
