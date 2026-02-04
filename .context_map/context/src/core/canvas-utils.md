# Context Map: canvas-utils.js

## 1. Purpose
Core image manipulation toolkit. Provides fundamental utilities for loading images, resizing canvases, applying masks/filters (Sobel/Blur), and handle exports. Designed to abstract browser-native canvas APIs into reusable async functions.

## 2. Imports
- No external imports (Browser native APIs only).

## 3. Dependencies
- **Uses**:
  - Native browser APIs: `Image`, `CanvasRenderingContext2D`, `Blob`, `FileReader`, `URL`.
- **Used by**:
  - `main.js`: Primary consumer for UI canvas updates and file handling.
  - All service processors: For transforming model outputs back into visual elements.

## 4. State Management
(Empty - Stateless utility module)

## 5. Project Flow
1. **Intake Stage**: `loadImage` and `fileToDataURL` transform raw user uploads into manipulatable objects.
2. **Processing Stage**: Functions like `applyMask`, `applyBlurToRegions`, and `applySobelFilter` execute visual transformations directly on the canvas buffers.
3. **Advanced Synthesis**: `surgicalInpaint` manages multi-iterative diffusion to fill masked areas without subject-bleed.
4. **Export Stage**: `canvasToBlob` and `downloadCanvas` facilitate saving results back to the local system.

## 6. Code Structure

- **`loadImage` (Function)**
  - **Name (Type)**: loadImage (Utility)
  - **Syntax**: `export async function loadImage(source)`
  - **Purpose**: Asynchronous image loader.
  - **Working**: Handles both URLs and Blob/File objects. Implements a Promise-based wrapper around `img.onload` and ensures proper memory cleanup via `URL.revokeObjectURL`.

- **`fileToDataURL` (Function)**
  - **Name (Type)**: fileToDataURL (Utility)
  - **Syntax**: `export function fileToDataURL(file)`
  - **Purpose**: Converts a File object to a Base64 string for previewing or storage.

- **`imageToCanvas` (Function)**
  - **Name (Type)**: imageToCanvas (Utility)
  - **Syntax**: `export function imageToCanvas(img)`
  - **Purpose**: Converts an `HTMLImageElement` into a canvas context pair.
  - **Working**: Creates a new canvas matching the image's dimensions and draws the image onto it.

- **`resizeCanvas` (Function)**
  - **Name (Type)**: resizeCanvas (Utility)
  - **Syntax**: `export function resizeCanvas(sourceCanvas, maxDimension = 2048)`
  - **Purpose**: Downscales a canvas while maintaining aspect ratio.
  - **Working**: Calculates the scale factor based on the largest dimension to ensure the image fits within the `maxDimension` cap.

- **`canvasToBitmap` (Function)**
  - **Name (Type)**: canvasToBitmap (Utility)
  - **Syntax**: `export async function canvasToBitmap(source)`
  - **Purpose**: Converts a canvas/image to a zero-copy `ImageBitmap` for worker transfers.

- **`applyMask` (Function)**
  - **Name (Type)**: applyMask (Visual Filter)
  - **Syntax**: `export function applyMask(imageCanvas, maskData)`
  - **Purpose**: Applies an alpha transparency mask to an image.
  - **Working**: Directly manipulates the alpha channel index (`data[i * 4 + 3]`) of the canvas's `Uint8ClampedArray` based on the provided 1-channel mask buffer.

- **`applyBlurToRegions` (Function)**
  - **Name (Type)**: applyBlurToRegions (Visual Filter)
  - **Syntax**: `export function applyBlurToRegions(canvas, regions, blurAmount = 20)`
  - **Purpose**: Selectively blurs specific areas of a canvas.
  - **Working**: Uses `ctx.clip()` combined with the native `ctx.filter = 'blur(...)'` API to apply localized softening.

- **`canvasToBlob` (Function)**
  - **Name (Type)**: canvasToBlob (Utility)
  - **Syntax**: `export async function canvasToBlob(canvas, type = 'image/png', quality = 0.92)`
  - **Purpose**: Promise-based wrapper for the native `toBlob()` callback.

- **`downloadCanvas` (Function)**
  - **Name (Type)**: downloadCanvas (IO)
  - **Syntax**: `export async function downloadCanvas(canvas, filename = 'image.png', type = 'image/png')`
  - **Purpose**: Triggers a programmatic browser download of a canvas.

- **`applySobelFilter` (Function)**
  - **Name (Type)**: applySobelFilter (Visual Filter)
  - **Syntax**: `export function applySobelFilter(canvas, threshold = 50)`
  - **Purpose**: Edge detection for line-art generation.
  - **Working**: Performs a grayscale pre-pass followed by convolution using Sobel X and Y kernels. Inverts the magnitude to provide black edges on a white background.

- **`surgicalInpaint` (Function)**
  - **Name (Type)**: surgicalInpaint (Advanced Synthesis)
  - **Syntax**: `export function surgicalInpaint(canvas, maskCanvas, iterations = 30)`
  - **Purpose**: Fills masked areas by diffusing surrounding pixel colors.
  - **Working**: Implements **Boundary Diffusion Theory**. It first calculates an average color from the boundary pixels to "pre-seed" the masked area (L233-255). It then executes a neighbor-averaging loop (Heat Equation solver) over several iterations to blend textures smoothly without bleeding the removed subject's colors.

## 7. Points To Consider
- **Memory Hygiene**: Consider always using `URL.revokeObjectURL` (L31) after loading blobs to prevent browser memory bloat in long-running sessions.
- **Resolution Capping**: Note that `resizeCanvas` (L48) should typically be used before heavy AI inference to stay within GPU/Browser memory limits (typically 2048px).
- **Blocking Operations**: Consider that `getImageData`/`putImageData` loops (L59) can block the main thread; for 4K+ images, delegating to a worker is usually more performant.
- **Inpainting Iterations**: Note that increasing iterations beyond 60 (L87) usually provides diminishing returns while increasing CPU latency.
