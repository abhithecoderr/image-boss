# Context Map: captioning/processor.js


## 1. Purpose

The main-thread interface for the Florence-2 vision service. It handles the communication with the captioning worker and implements the "Bottom-Bar" rendering logic that overlays AI-generated text descriptions onto the bottom of the source image for unified result containers.


## 2. Imports

- **Worker**:
  - Syntax: `import Worker from './worker.js?worker';`
  - Purpose: Initializes the Florence-2 inference thread.


## 3. Dependencies

- **Used by**:
  - `useProcessor.js` (Invoked when the 'captioning' service is selected).

- **External APIs**:
  - **Canvas API (Text Measurement)**: Uses `ctx.measureText` for dynamic word-wrapping of long AI descriptions.
  - **createImageBitmap**: Zero-copy transfer of the subject image to the worker.


## 4. State Management

- **worker (Variable)**:
  - Syntax: `let worker = null;`
  - Purpose: Singleton worker reference.


## 5. Project Flow

### 1. Ingestation
- **Flow**: Captures the source canvas and transfers it to the Florence-2 worker.

### 2. Inference
- **Flow**: Awaits the structured JSON result from the AI (containing `raw` results and the cleaned `caption`).
- **Files Involved**:
  - `worker.js`: Executes the vision-language model inference.

### 3. Layout Calculation
- **Flow**: `createCaptionOverlay` calculates the required height for the result container by wrapping the text based on the image width.

### 4. Synthesis
- **Flow**: Creates a new, taller canvas. Renders a black background, the original image at the top, and the word-wrapped text at the bottom.

### 5. Realization
- **Flow**: Resolves the promise with both the final `canvas` and the raw `caption` string.


## 6. Code Structure

- **process (Function)**:
  - Syntax: `export async function process(sourceCanvas, options = {}, onProgress) { ... }`
  - Purpose: The primary async orchestrator.

- **createCaptionOverlay (Function)**:
  - Syntax: `function createCaptionOverlay(sourceCanvas, caption) { ... }`
  - Purpose: Generates the "Result Card" visual for captioning.
  - Working: Implements a manual word-wrap algorithm using `split(' ')` and `measureText`. It expands the canvas height dynamically (`sourceCanvas.height + bottomBarHeight`) to ensure the text never overlaps the image pixels.

- **createSegmentationOverlay (Function)**:
  - Syntax: `function createSegmentationOverlay(sourceCanvas, polygons) { ... }`
  - Purpose: Generates the "Result Card" visual for segmentation.
  - Working: Stacks two renderings: a B&W binary mask (Top) and a clean subject cutout on a black background (Bottom). It uses `ctx.filter = 'blur(1.5px)'` on the mask to anti-alias edges and `globalCompositeOperation = 'destination-in'` to clip the original pixels into the subject shape.

- **Manual Polygon Parser (Logic)**:
  - Purpose: Safety net for Transformers.js post-processing failures.
  - Working: A regex-based fallback that extracts `[x, y]` coordinate pairs from raw location token strings (`<loc123><loc456>...`), ensures proper scaling, and reconstructs the JSON result expected by the renderer.


## 7. Points To Consider

- **Font Styling Invariant**: The overlay hardcodes `font: 600 24px Inter`. If the "Inter" font is not loaded in the parent CSS, it will fall back to `-apple-system`, which may alter the text measurement and cause clipping.

- **The "Dataset" Metadata**: The final result canvas has `resultCanvas.dataset.caption = caption` attached. This is used by the `App.jsx` layer for "Copy to Clipboard" functionality without re-parsing the image.

- **Zero-Copy Performance**: Using `createImageBitmap` ensures that large high-res photos don't freeze the main thread's UI event loop during the transfer to the worker.

- **Dynamic Tasking**: The processor passes a `task` parameter (e.g., `<MORE_DETAILED_CAPTION>`) to the worker, allowing the UI to toggle between short and long AI descriptions.
