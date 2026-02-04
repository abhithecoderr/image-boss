# Context Map: captioning/processor.js

## 1. Purpose
Management layer for image description services. Orchestrates the Florence-2 worker lifecycle and implements a specialized canvas generator for rendering descriptive overlays at high resolutions.

## 2. Imports
- **worker.js?worker**: The background thread implementation.

## 3. Dependencies
- **Uses**:
  - [worker.js](file:///c:/projects/bg/my-ai-app/src/services/captioning/worker.js): Background AI implementation.
- **Used by**:
  - `main.js`: Primary UI orchestrator.

## 4. State Management

- **worker (Variable/Worker)**
  - **Syntax**: `let worker = null`
  - **Purpose**: Lazy-loaded singleton for the captioning thread.

## 5. Project Flow
1. **Intake Stage**: Receives a `sourceCanvas` and task parameters from the main UI.
2. **Transfer Stage**: Converts the canvas into an `ImageBitmap` for zero-copy worker ingestion.
3. **Execution Stage**: The worker performs the Florence-2 generative pass.
4. **Synthesis (Rendering Loop)**:
   - Receives the final caption string.
   - Invokes `createCaptionOverlay`.
   - This function performs a manual **Word-Wrap Pass** using canvas `measureText` (L89) to calculate the required vertical space.
   - It appends a dark "Letterbox" to the bottom of the image and renders the description text.
5. **Return Stage**: Returns both the raw caption string (for the UI) and the result canvas (for downloads).

## 6. Code Structure

- **`getWorker` (Function)**
  - **Name (Type)**: getWorker (Singleton Helper)
  - **Syntax**: `function getWorker()`

- **`process` (Function)**
  - **Name (Type)**: process (Primary Entry Point)
  - **Syntax**: `export async function process(sourceCanvas, options = {}, onProgress)`
  - **Working**: Orchestrates the IPC loop. Returns a combined object containing the `canvas` and the descriptive `caption` text.

- **`createCaptionOverlay` (Function)**
  - **Name (Type)**: createCaptionOverlay (Visual Synth)
  - **Syntax**: `function createCaptionOverlay(sourceCanvas, caption)`
  - **Purpose**: Generates a high-quality "Captioned" version of the original image.
  - **Working**:
    - **Dynamic Letterboxing**: Calculates the height of a black bar based on the length of the caption and the font size (L105).
    - **Centered Typography**: Renders the multi-line caption centered within the new letterbox area using the "Inter" system font.

## 7. Points To Consider
- **Context Preservation**: Consider re-applying `ctx.font` after any canvas resize (L52) to prevent the context from reverting to browser defaults and breaking the layout.
- **IPC Efficiency**: Note that `createImageBitmap` (L53) is used to ensure the large model can process frames without blocking the main event loop.
- **Extended Metadata**: Consider that `result.raw` contains detection coordinates (L54) which could be used for future bounding-box visualization features.
