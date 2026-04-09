# Context Map: compression/processor.js


## 1. Purpose

The utility interface for client-side image optimization. It utilizes the `browser-image-compression` library to reduce file sizes (KB/MB) without server-side processing, managing the conversion between Canvas, Blob, and File objects required for local optimization workflows.


## 2. Imports

- **imageCompression**:
  - Syntax: `import imageCompression from 'browser-image-compression';`
  - Purpose: The core optimization engine that handles resizing and JPEG/WebP quantization.

- **canvas-utils**:
  - Syntax: `import { loadImage, imageToCanvas, canvasToBlob } from '../../core/canvas-utils.js';`
  - Purpose: I/O management for the "Canvas -> File -> Canvas" lifecycle.


## 3. Dependencies

- **Used by**:
  - `useProcessor.js` (Invoked when the 'compression' service is selected).


## 4. State Management

- **Non-Standard**: This processor is stateless. It operates as a pure async transform of the input image buffer.


## 5. Project Flow

1. **Mapping**: Translates UI presets ('light', 'medium', 'heavy') into numeric `maxSizeMB` and `quality` constraints.

2. **File Conversion**: Converts the `sourceCanvas` into a JPEG `File` object using `canvasToBlob`.

3. **Optimization**: Invokes `imageCompression` with a dedicated web worker to prevent main-thread UI freezes.

4. **Decoding**: Converts the resulting compressed `Blob` back into a `HTMLCanvasElement`.

5. **Reporting**: Calculates the "Reduction %" based on the byte difference between the original and compressed files.


## 6. Code Structure

- **process (Function)**:
  - Syntax: `export async function process(sourceCanvas, options = {}, onProgress) { ... }`
  - Purpose: The compression orchestrator.
  - Working: Manages the `compressionOptions` bridge. It hooks into the library's internal progress callback (`onProgress`) to provide granular percentage updates (e.g., "Compressing... 45%") back to the global application state.


## 7. Points To Consider

- **The Presets Invariant**: Presets are used to simplify the UX. 'Heavy' compression targets 0.5MB with 60% quality, while 'Light' targets 2MB with 90% quality.

- **Web Worker Usage**: `useWebWorker: true` is enabled by default to ensure that large images don't block the browser's main thread during the quantization process.

- **Format Hardcoding**: The compression process currently forces the internal bridge to `image/jpeg`. This ensures maximum compression ratio but will lose transparency (alpha channel) from PNG sources.

- **Metadata Retention**: `imageCompression` typically strips EXIF data for privacy and size reduction. This is a deliberate design choice for a "Client-Side Privacy" application.
