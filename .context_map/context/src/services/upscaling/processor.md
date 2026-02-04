# Context Map: upscaling/processor.js

## 1. Purpose
Management layer for the upscaling service. Provides the API for triggering heavy AI upscales and lightweight post-processing refinements. Manages the worker lifecycle and handles the conversion between ImageBitmaps and visible Canvas elements.

## 2. Imports
- **worker.js?worker**: The background thread implementation.

## 3. Dependencies
- **Uses**:
  - [worker.js](file:///c:/projects/bg/my-ai-app/src/services/upscaling/worker.js): Background AI implementation.
- **Used by**:
  - `main.js`: Primary UI orchestrator.

## 4. State Management

- **worker (Variable/Worker)**
  - **Syntax**: `let worker = null`
  - **Purpose**: Lazy-loaded singleton for the upscaling thread.

## 5. Project Flow
1. **Intake Stage**: `main.js` calls `process()` with a source canvas and desired upscale parameters.
2. **Transfer Stage**: The processor converts the canvas into an `ImageBitmap` to utilize zero-copy memory transfers to the worker.
3. **Execution Stage**: The worker performs the tiling and frequency separation. The processor channels progress messages back to the status bar.
4. **Synthesis Stage**:
   - The processor receives a result `ImageBitmap`.
   - It creates a new canvas at the destination resolution.
   - It draws the bitmap and immediately Closes the bitmap to free graphics memory.
5. **Return Stage**: The high-res canvas is returned for display in the workspace.

## 6. Code Structure

- **`getWorker` (Function)**
  - **Name (Type)**: getWorker (Singleton Helper)
  - **Syntax**: `function getWorker()`

- **`process` (Function)**
  - **Name (Type)**: process (Primary Entry Point)
  - **Syntax**: `export async function process(sourceCanvas, options = {}, onProgress)`
  - **Working**: Orchestrates the full upscaling lifecycle. This is the "Heavy" call used for the first pass or when the upscale factor changes.

- **`refine` (Function)**
  - **Name (Type)**: refine (Lightweight Pass)
  - **Syntax**: `export async function refine(options = {})`
  - **Working**: Used for real-time slider adjustments (details, brightness, sat). Sends a command to the worker to re-run the filter pass on cached data.

## 7. Points To Consider
- **Transferable Performance**: Consider including the `bitmap` in the `postMessage` transfer list (L48) to ensure zero-copy memory movement and prevent main-thread stutter.
- **Bitmap Hygiene**: Note that results can be 8MB-32MB; consider calling `result.close()` (L49) immediately after drawing to a canvas to manage graphics memory efficiently.
- **Progress Debouncing**: Consider debouncing `refine` calls from the UI (L50) to prevent saturating the IPC channel during rapid slider interactions.
