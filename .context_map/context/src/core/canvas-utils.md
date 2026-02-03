# Context Map: canvas-utils.js

## Purpose
Core image manipulation toolkit. Provides fundamental utilities for loading images, resizing canvases, applying masks/filters (Sobel/Blur), and handle exports. Designed to abstract browser-native canvas APIs into reusable async functions.

## Imports
- No external imports (Browser native APIs only)

## Dependencies
- **Used by**:
  - `main.js`: Primary consumer for UI canvas updates and file handling
  - All service processors: For transforming model outputs back into visual elements
- **Uses**:
  - `Image`, `CanvasRenderingContext2D`, `Blob`, `FileReader`, `URL` (Native APIs)

## Project Flow Connection
- **In-take stage**: `loadImage` and `fileToDataURL` handle the transformation of user uploads into manipulatable objects.
- **Processing stage**: `applyMask`, `applyBlurToRegions`, and `applySobelFilter` execute the direct visual transformations.
- **Export stage**: `canvasToBlob` and `downloadCanvas` facilitate saving results back to the user's local system.

## File Code Structure

**`loadImage(source)`** (L9-29): Loads an image from a URL or Blob into an `HTMLImageElement` using a Promise.

**`fileToDataURL(file)`** (L34-41): Wraps `FileReader` to convert a file to a base64 string.

**`imageToCanvas(img)`** (L46-53): Draws an image onto a new canvas and returns both the canvas and its 2D context.

**`surgicalInpaint(canvas, maskCanvas, iterations)`** (L217-270):
- **Boundary Initialization** (L231-255): Calculates average color of non-masked neighbors to pre-fill the object area, preventing subject-bleed.
- **Diffusion Pass** (L257-268): Executes 60 iterations (L254) of neighbor-averaging to blend textures naturally.

**`applyMask(imageCanvas, maskData)`** (L86-107): Merges an image with an alpha mask array by direct pixel manipulation of the alpha channel (L102).

**`applyBlurToRegions(canvas, regions, blurAmount)`** (L112-142): Uses `canvas.clip()` and `ctx.filter = 'blur(...)'` to selectively blur portions of an image.

**`canvasToBlob(canvas, type, quality)`** (L147-151): Promise wrapper for `canvas.toBlob()`.

**`downloadCanvas(canvas, filename, type)`** (L156-164): Triggers a browser download by creates a temporary `<a>` element.

**`applySobelFilter(canvas, threshold)`** (L169-215): Grayscale conversion followed by manual Sobel kernel convolution for edge detection.

## Code Details

**`async function loadImage()`** (L14-27): Logic branch for input types. Uses `if (source instanceof Blob)` for `URL.createObjectURL` and `else` for string paths. Ensures garbage collection via `URL.revokeObjectURL` (L19, L23) in `.onload` and `.onerror` handlers.

**`async function applyMask()`** (L86-107): Direct buffer access via `ctx.getImageData`. `for loop i` (L98-105) maps `maskData` intensities (0-255) to the `data[i * 4 + 3]` alpha channel index of the `Uint8ClampedArray`.

**`async function applySobelFilter()`** (L169-215): Grayscale pre-pass (L179-182) followed by convolution. `for loop y/x` (L190-209) applies `const horizontal_kernel` (L185) and `const vertical_kernel` (L186) to derive `Math.sqrt(gx * gx + gy * gy)` magnitudes.

**`async function downloadCanvas()`** (L156-164): Programmatic `<a>` tag injection. `const link` (L157) uses `canvas.toDataURL` for `href` and `link.click()` for immediate browser triggering.
