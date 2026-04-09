# Context Map: canvas-utils.js


## 1. Purpose

The low-level pixel manipulation and image I/O engine for the application. It provides essential utilities for loading images from diverse sources (Blobs, Files, URLs), converting them into high-performance `ImageBitmaps`, scaling canvases while preserving aspect ratios, and applying specialized computer vision filters like Sobel edge detection and Surgical Inpainting.


## 2. Imports

- **Non-Standard**: This module is a pure utility library and does not depend on external JavaScript imports. It utilizes native browser APIs exclusively.


## 3. Dependencies

- **Used by**:
  - `AppContext.jsx` (For file ingestion processing).
  - `useFileIngestion.js` (For loading and resizing user images).
  - `useProcessor.js` (For converting results and creating bitmaps).
  - All AI Processors (For masking, blurring, and filtering).

- **External APIs**:
  - **HTML5 Canvas API**: The primary rendering interface.
  - **ImageBitmap API**: Used for zero-copy data transfer to Workers.
  - **URL.createObjectURL**: Used for memory-efficient asset loading.


## 4. State Management

- **Non-Standard**: This is a stateless utility module. It operates on passed-in `HTMLCanvasElement`, `Blob`, or `Image` objects and returns new instances or modified buffers.


## 5. Project Flow

1. **Intake**: User-provided files are passed to `loadImage` or `fileToDataURL`.

2. **Standardization**: The resulting image is converted via `imageToCanvas` to extract a drawable pixel buffer.

3. **Inference Prep**: Large images are downscaled using `resizeCanvas` before being converted to `ImageBitmap` via `canvasToBitmap` for worker transfer.

4. **Synthesis**: After AI processing, the results are applied back to canvases using `applyMask` or `applyBlurToRegions`.

5. **Realization**: The final artistic or upscaled output is delivered to the user via `downloadCanvas`.


## 6. Code Structure

- **loadImage (Function)**:
  - Syntax: `export async function loadImage(source) { ... }`
  - Purpose: Promisified image loader with automatic memory cleanup.
  - Working: Detects if the source is a `Blob` or `File`, creates an object URL, and returns a resolved `HTMLImageElement` upon completion. Crucially, it calls `URL.revokeObjectURL` in both success and error paths to prevent memory leaks.

- **imageToCanvas (Function)**:
  - Syntax: `export function imageToCanvas(img) { ... }`
  - Purpose: Extracts a 2D context from an image.
  - Working: Creates a new `<canvas>`, sets dimensions to the image's `naturalWidth/Height`, and performs a 1:1 `drawImage` transfer. Returns both the canvas and context.

- **resizeCanvas (Function)**:
  - Syntax: `export function resizeCanvas(sourceCanvas, maxDimension = 2048) { ... }`
  - Purpose: High-performance aspect-ratio scaling.
  - Working: Calculates the scale factor based on the longest edge, creates a smaller buffer, and utilizes browser-native bilinear interpolation via `drawImage` to produce the resized output.

- **applyMask (Function)**:
  - Syntax: `export function applyMask(imageCanvas, maskData) { ... }`
  - Purpose: Composites an AI-generated alpha mask onto an image.
  - Working: Extracts `ImageData` from the source, iterates through the `maskData` (Uint8Array), and overwrites the alpha channel (`data[i * 4 + 3]`) for every pixel before re-applying with `putImageData`.

- **downloadCanvas (Function)**:
  - Syntax: `export async function downloadCanvas(canvas, filename = 'image.png', type = 'image/png') { ... }`
  - Purpose: Triggers a browser-initiated file download.
  - Working: Converts the canvas to a `Blob`, creates a temporary `<a>` element with the `download` attribute, and programmatically clicks it.

- **surgicalInpaint (Function)**:
  - Syntax: `export function surgicalInpaint(canvas, maskCanvas, iterations = 30) { ... }`
  - Purpose: Theoretical "Fast Surgical Inpaint" via diffusion.
  - Working: Identifies the average boundary color around a mask, initializes the masked area with that color, and performs iterative edge-averaging (Laplacian-like diffusion) across the pixels to "heal" the masked region by pulling colors from the surrounding area.


## 7. Points To Consider

- **Zero-Copy Invariant**: The `canvasToBitmap` function is the preferred way to move image data to Workers because `ImageBitmap` is a "Transferable Object" that avoids the massive overhead of Cloning or JSON serialization for multi-megabyte buffers.

- **Memory Hygiene**: Any function using `URL.createObjectURL` MUST have a corresponding `revokeObjectURL` call. Failure to do this in high-frequency sessions (like video frame processing) will crash the browser tab.

- **Alpha Channel Trap**: When applying masks via `applyMask`, the function directly manipulates the 4th byte of every pixel. This must be done on a canvas context that supports transparency (default).

- **Performance Bottleneck**: Functions using `getImageData` and `putImageData` (like `applyMask` and `applySobelFilter`) are CPU-bound. For real-time filters on 4K images, consider moving these operations to a WebGPU compute shader or a Worker.
