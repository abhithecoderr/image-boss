# Context Map: file-conversion/processor.js

## Purpose
Native browser-based image format converter. Orchestrates target-format encoding using standard Canvas APIs, handling specific edge cases like transparency-to-opaque conversions for JPEG outputs.

## Imports
- **../../core/canvas-utils.js**: `canvasToBlob` - Core export utility.

## Dependencies
- **Used by**:
  - `main.js`: Primary feature for switching between PNG, JPEG, and WebP
- **Uses**:
  - `OffscreenCanvas` / `HTMLCanvasElement`: Executes the pixel transfer and encoding.

## Project Flow Connection
- **Conversion Phase**: `process` (L15-46) isolates the source canvas data, applies a white background for non-alpha formats (L27-30), and re-encodes the buffer.
- **Metadata Tagging**: Injects `dataset` attributes (`format`, `quality`) directly into the `resultCanvas` (L40-41) to pass export instructions to the global `downloadResult` function.

## File Code Structure

**`process(sourceCanvas, options, onProgress)`** (L15-46):
- **Opaque Fallback** (L27-30): Detects `image/jpeg` target and fills an initially transparent canvas with `#ffffff` (white) to prevent black artifacts in areas of high transparency.
- **Re-drawing** (L32): Standard `drawImage` call to move source pixels onto the newly formatted destination canvas.
- **Encoding Verification** (L37): Calls `canvasToBlob` to ensure the browser can successfully serialize the image in the requested format.
- **Feedback** (L43): Reports the final encoded file size in KB.

## Code Details

**`ctx.fillStyle = '#ffffff'` block** (L27-30): Transparency mitigation. Runs conditionally `if (type === 'image/jpeg')`. Fills the buffer background with white before original pixels are drawn.

**`canvas.dataset.format` assignment** (L40-41): Side-channel metadata injection. Attaches export intent directly to the DOM node for retrieval by the global `downloadResult` function.

**`await canvasToBlob()` check** (L37): Final verification stage in the `process` branch. Ensures the target encoding (e.g., `image/webp`) is supported by the user's browser engine.
