# Context Map: captioning/processor.js

## Purpose
Main-thread interface for the automatic image captioning service. Manages a background worker for running the ViT-GPT2 model and implements a custom Canvas overlay system to render generated text directly onto the image result.

## Imports
- **worker.js**: Loaded as a dedicated Web Worker (L6)

## Dependencies
- **Used by**:
  - `main.js`: Main UI component for generating image descriptions
- **Uses**:
  - `captioning/worker.js`: Handles heavy image-to-text inference

## Project Flow Connection
- **In-take**: Converts `sourceCanvas` to a high-quality data URL (L29) for IPC transfer.
- **Rendering**: `createCaptionOverlay` (L62-108) expands the canvas and draws a custom text bar at the bottom.
- **Data Persistence**: Stores the raw caption in `resultCanvas.dataset.caption` (L105) for easier copying by other UI components.

## File Code Structure

**`getWorker()`** (L10-15): Singleton worker instance provider.

**`process(sourceCanvas, options, onProgress)`** (L24-57): Main async entry point. Handles message routing for `progress`, `complete`, and `error` types from the worker.

**`createCaptionOverlay(sourceCanvas, caption)`** (L62-108):
- **Layout** (L63-67): Adds a 60px black padding bar to the bottom of the original canvas.
- **Styling** (L70-84): Sets background color, font (Inter 16px), and alignment.
- **Word Wrap Logic** (L87-102): Manually calculates text width via `ctx.measureText` to ensure captions fit within canvas boundaries.

## Code Details

**`canvas.toDataURL('image/png')` call** (L29): Encodes the `sourceCanvas` into a base64 string for transmission via `worker.postMessage`.

**`function createCaptionOverlay()` wrapping loop** (L87-102): Manual text layout engine. Uses a `while (words.length > 0)` loop and `ctx.measureText` to calculate width-based line breaks.

**`onProgress(0.95, 'Rendering...')` injection** (L37, L45): Synthetic UI stage added within the `process` branch to bridge the IPC gap during the final overlay draw.
