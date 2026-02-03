# Context Map: line-art/processor.js

## Purpose
Light-weight processor for edge detection. Acts as a simple wrapper around the core Sobel filtering utility, allowing for rapid extraction of line art from images directly on the main thread.

## Imports
- **../../core/canvas-utils.js**: `applySobelFilter` - Core mathematical filter implementation.

## Dependencies
- **Used by**:
  - `main.js`: Provides the "Line Art" feature in the navigation
- **Uses**:
  - `canvas-utils.js`: Executes the actual pixel-by-pixel convolution.

## Project Flow Connection
- **In-Memory Transformation**: Unlike AI-based services, this processor works entirely within the local context, cloning the source canvas (L21) and applying non-destructive filters.
- **Immediate Result**: Provides nearly instantaneous feedback due to low computational complexity.

## File Code Structure

**`process(sourceCanvas, options, onProgress)`** (L15-33):
- **Canvas Cloning** (L21-25): Creates an independent copy of the source to avoid modifying the UI's original image reference.
- **Filter Application** (L28): Calls `applySobelFilter` with a user-defined intensity `threshold`.

## Code Details

**`const resultCanvas = document.createElement('canvas')`** (L21): Local allocation inside `process`. Ensures no modifications escape the processor context until explicit delivery.

**`applySobelFilter(resultCanvas, threshold)` call** (L28): Synchronous execution on the main thread. Maps the user-defined `threshold` (default 50) directly to the WebGL shader's edge sensitivity.
