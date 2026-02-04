# Context Map: file-conversion/processor.js

## 1. Purpose
Lightweight utility for changing image file formats (PNG, JPEG, WebP). Leverages native browser encoding APIs for maximum performance and minimum dependency overhead.

## 2. Imports
- **../../core/canvas-utils.js**: `canvasToBlob` - used for the final format encoding.

## 3. Dependencies
- **Uses**:
  - Native browser `toBlob` encoding.
- **Used by**:
  - `main.js`: Main UI orchestrator.

## 4. State Management
(Empty - Stateless utility service)

## 5. Project Flow
1. **Structure**: Receives the source and target MIME type.
2. **Normalization**: Creates a fresh canvas. If converting to JPEG, it performs an **Alpha Flattening Pass** by filling the background with white (L28).
3. **Encoding**: Invokes the browser's native encoder at the requested quality level.
4. **Metadata**: Attaches the target format information to the canvas `dataset` (L40) so the Downloader knows which extension to use.

## 6. Code Structure

- **`process` (Function)**
  - **Name (Type)**: process (Primary Entry Point)
  - **Syntax**: `export async function process(sourceCanvas, options, onProgress)`
  - **Working**: Simple linear flow. Handles the visual transition from transparent (PNG) to opaque (JPEG) formats.

## 7. Points To Consider
- **Transparency Handling**: Consider that the white-fill pass (L29) is vital when converting PNGs to JPEG because it prevents visual artifacts in transparent areas.
- **Metadata Extension**: Note that the `dataset` attachment on the canvas (L40) is the bridge used by the downloader to correctly identify the target file extension.
