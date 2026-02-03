# Context Map: compression/processor.js

## Purpose
Main-thread interface for the smart image compression service. Leverages the `browser-image-compression` library to reduce file size while maintaining visual quality. Orchestrates the conversion between Canvas, Blob, and File objects required for the compression pipeline.

## Imports
- **browser-image-compression**: Third-party library for efficient client-side compression.
- **../../core/canvas-utils.js**: `loadImage`, `imageToCanvas`, `canvasToBlob` - Data format conversion utilities.

## Dependencies
- **Used by**:
  - `main.js`: Provides compression features in the UI
- **Uses**:
  - `browser-image-compression`: Executes the actual compression logic in a background worker (L32).

## Project Flow Connection
- **In-take Serialization**: `canvasToBlob` (L22) and `new File` (L23) prepare the image for the library's input requirements.
- **Transformation Phase**: `imageCompression` (L39) runs the core algorithm with user-defined constraints (max size/initial quality).
- **Result Re-conversion**: `loadImage` (L45) and `imageToCanvas` (L46) transform the compressed Blob back into a display-ready `HTMLCanvasElement`.

## File Code Structure

**`process(sourceCanvas, options, onProgress)`** (L16-53):
- **Option Extraction** (L17): Defaults to 1MB max size and 80% quality.
- **Library Configuration** (L29-37): Sets `maxWidthOrHeight` (L31) to match original dimensions and enables multi-threaded processing via `useWebWorker: true` (L32).
- **Progress Feedback** (L34-36): Maps the library's internal progress percentage into the application's granular status updates.
- **Metrics Calculation** (L48-50): Determines the percentage reduction in file size (L48) for the final UI toast.

## Code Details

**`new File([blob], 'image.jpg')` conversion** (L22-23): Prepares the raw `sourceCanvas` blob for the library's `imageCompression` entry point.

**`onProgress: (p) => ...` lambda** (L35): Callback defined inside the options object. Multiplies raw library values by `0.006` to align with the global progress bar mapping.

**`loadImage(resultBlob)` sequence** (L44-47): Executes after compression. Re-hydrates the byte-optimized result into a visible `HTMLCanvasElement` using `canvas-utils.js` helpers.
