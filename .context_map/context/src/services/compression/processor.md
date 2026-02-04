# Context Map: compression/processor.js

## 1. Purpose
Management layer for the image compression service. Provides an interface to reduce image file size via iterative quality and resolution scaling. Utilizes the browser-image-compression library for thread-safe execution.

## 2. Imports
- **browser-image-compression**: Third-party library for the compression engine.
- **../../core/canvas-utils.js**: `loadImage`, `imageToCanvas`, `canvasToBlob` - helpers for data type interop.

## 3. Dependencies
- **Uses**:
  - Browser Workers (via the library).
- **Used by**:
  - `main.js`: Main UI orchestrator.

## 4. State Management
(Empty - Stateless utility service)

## 5. Project Flow
1. **Preparation**: Converts the `sourceCanvas` into a JPEG `Blob` (L22) to satisfy the library's file-based API.
2. **Configuration**: Maps UI quality and size presets to the library's configuration object.
3. **Execution**: Triggers the `imageCompression` worker pass. Tracks progress percentage for the main status bar.
4. **Resynthesis**: Converts the compressed `Blob` back into an `HTMLImageElement` and finally back to a `Canvas` for workspace display.

## 6. Code Structure

- **`process` (Function)**
  - **Name (Type)**: process (Primary Entry Point)
  - **Syntax**: `export async function process(sourceCanvas, options, onProgress)`
  - **Working**:
    - **Resolution Invariant**: Always preserves the original aspect ratio by setting `maxWidthOrHeight` to the source dimensions (L31).
    - **Reduction Reporting**: Calculates final byte-savings percentage (L48) to provide meaningful feedback to the user.

## 7. Points To Consider
- **Intermediate Format**: Consider that the processor utilizes a JPEG intermediate (L22) for the compression pass because it provides the most predictable size reduction across different source types.
- **Progress Scaling**: Note that the library's 0-100% progress is scaled to the 0.2-0.8 app range (L35) to prevent the status bar from jumping during pre- and post-processing steps.
