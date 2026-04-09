# Context Map: file-conversion/processor.js


## 1. Purpose

A native utility for changing image file formats (WebP, JPEG, PNG). It leverages the browser's internal encoding engines to perform fast, high-quality conversions directly on the canvas without external dependencies.


## 2. Imports

- **canvasToBlob**:
  - Syntax: `import { canvasToBlob } from '../../core/canvas-utils.js';`
  - Purpose: The primary encoding bridge for generating the target format buffer.


## 3. Dependencies

- **Used by**:
  - `useProcessor.js` (Invoked when 'file-conversion' is selected).


## 4. State Management

- **Non-Standard**: Stateless.


## 5. Project Flow

1. **Canvas Setup**: Creates a replica canvas.

2. **Background Handling**: If converting to `image/jpeg`, it fills the background with `#ffffff` (White) to ensure a clean result, as JPEG cannot store transparency.

3. **Encoding**: Calls `canvasToBlob` with the requested `format` (e.g., `image/webp`) and `quality` (0.0 to 1.0).

4. **Metadata Attachment**: Attaches the format info to the canvas `dataset`.

5. **Realization**: Returns the canvas and displays the resulting file size in the status bar.


## 6. Code Structure

- **process (Function)**:
  - Syntax: `export async function process(sourceCanvas, options = {}, onProgress) { ... }`
  - Purpose: The conversion orchestrator.
  - Working: Performs conditional logic for opaque vs transparent formats. It uses `canvas.toBlob` (via the utility) to verify that the browser supports the requested MIME type before resolving.


## 7. Points To Consider

- **The White-Fill Invariant**: PNG-to-JPEG conversion requires a manual background fill. Without the `ctx.fillRect` call, transparent areas would become black in most browser engines.

- **Dataset Persistence**: `resultCanvas.dataset.format` is set here. This is a critical context signal for the "Download" button to use the correct file extension (e.g., `.webp` instead of the original `.jpg`).

- **Quality Factor**: The `quality` setting (default 0.92) only affects lossy formats like JPEG and WebP. It has no effect on PNG.

- **Browser Specifics**: Some older browsers do not support `image/webp` encoding. The `canvasToBlob` utility will fall back to `image/png` if the requested format is unsupported.
