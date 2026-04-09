# Context Map: line-art/processor.js


## 1. Purpose

The specialized processor for extracting high-contrast line art from images. Unlike AI-based services, this module utilizes a deterministic WebGL-accelerated Sobel filter to identify pixel discontinuities and convert them into clean black-and-white strokes.


## 2. Imports

- **applySobelFilter**:
  - Syntax: `import { applySobelFilter } from '../../core/canvas-utils.js';`
  - Purpose: Invokes the high-performance shader-based edge detection utility.


## 4. State Management

- **Non-Standard**: This processor is stateless and deterministic. It does not maintain a worker or internal cache.


## 3. Dependencies

- **Used by**:
  - `useProcessor.js` (Primary service path).

- **External APIs**:
  - **Canvas 2D Context**: For cloning and rendering the final edge map.


## 5. Project Flow

1. **Replication**: Creates a fresh canvas clone of the source image to avoid mutating the workspace buffers.

2. **Transformation**: Invokes the `applySobelFilter` with the user-defined `threshold`.

3. **Feedback**: Signals progress at 20% (start) and 100% (finish).

4. **Resolution**: Returns the modified canvas directly to the UI.


## 6. Code Structure

- **process (Function)**:
  - Syntax: `export async function process(sourceCanvas, options = {}, onProgress) { ... }`
  - Purpose: The edge extraction orchestrator.
  - Working: Simply acts as a wrapper around the `applySobelFilter` utility. It handles the canvas instantiation and progress broadcasting required by the global `useProcessor` hook.


## 7. Points To Consider

- **The Threshold Factor**: The `threshold` option determines the sensitivity of the edge detection. Higher values result in cleaner, minimalist line-art, while lower values preserve more background noise and texture.

- **Synchronous vs Async Trap**: While the function is `async` (to match the service interface), the underlying Sobel filter is currently a blocking CPU operations on the main thread (or a synchronous WebGL call). This represents a potential UI stutter point for 8K+ images.

- **Visual Consistency**: The resulting canvas is always a high-contrast binary-style image (black strokes on white or transparent background depending on the utility implementation).
