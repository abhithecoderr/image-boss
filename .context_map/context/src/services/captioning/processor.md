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
- **IPC Payload**: Passes `modelId` and `task` (e.g. `<MORE_DETAILED_CAPTION>`) to the worker (L72).
- **Rendering**: `createCaptionOverlay` (L82-128) expands the canvas and draws a custom text bar at the bottom.
- **Data Persistence**: Stores the raw caption in `resultCanvas.dataset.caption` (L125) for easier copying by other UI components.

## File Code Structure

**`getWorker()`** (L10-15): Singleton worker instance provider.

**`process(sourceCanvas, options, onProgress)`** (L24-77): Main async entry point.
- **Zero-Copy Transfer**: Invokes `createImageBitmap` and transfers the bitmap to the worker context.
- **Dynamic Options**: Passes the selected `task` (from UI selector) to the worker.

**`createCaptionOverlay(sourceCanvas, caption)`** (L82-128):
- **Layout**: Creates a padded canvas (`sourceCanvas.height + 60`).
- **Rendering**: Draws original image and wraps text into the black bottom bar.
