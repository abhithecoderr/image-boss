# Context Map: useFileIngestion.js


## 1. Purpose

The unified intake handler for all image formats. It manages the lifecycle of a newly selected image from the raw `File` object through validation, loading, canvas conversion, and global state initialization. It ensures that images are properly formatted and memory-resident before AI operations begin.


## 2. Imports

- **React**:
  - Syntax: `import { useCallback } from 'react';`
  - Purpose: Memoizes the handling function to ensure stable event handlers for the Workspace.

- **canvas-utils**:
  - Syntax: `import { loadImage, imageToCanvas } from '../core/canvas-utils';`
  - Purpose: Low-level utilities for Blob-to-Image loading and high-performance pixel buffer creation.

- **useApp**:
  - Syntax: `import { useApp } from '../context/AppContext';`
  - Purpose: Primary channel for updating the application's original image states.


## 4. State Management

- **Non-Standard**: This hook does not maintain local state. It acts exclusively as a writer to the global `AppContext`.


## 3. Dependencies

- **Used by**:
  - `Workspace.jsx` (For both click-to-browse and drag-and-drop triggers).

- **External APIs**:
  - **URL.createObjectURL**: (Implicitly via `loadImage`) for asset loading.


## 5. Project Flow

### 1. Validation
- **Flow**: Checks the raw `File` against the `MAX_SIZE` (5MB) limit.

### 2. Loading
- **Flow**: Invokes `loadImage` to bridge the gap from a disk file to a browser-renderable `HTMLImageElement`.

### 3. Pixel Extraction
- **Flow**: Calls `imageToCanvas` to generate a 2D context buffer from the image.
- **Files Involved**:
  - `canvas-utils.js`: Orchestrates the raw byte-to-canvas rendering logic.

### 4. State Realization
- **Flow**: Updates `setOriginalImage` (the object) and `setOriginalCanvas` (the buffer).
- **Files Involved**:
  - `AppContext.jsx`: Standardizes the new image as the primary source for all services.

### 5. Workspace Prep
- **Flow**: Clears `setResultCanvas(null)` to ensure the new image starts with a clean visual slate.
- **Files Involved**:
  - `AppContext.jsx`: Flushes the previous service output to prevent ghosting.


## 6. Code Structure

- **handleFile (Callback)**:
  - Syntax: `const handleFile = useCallback(async (file) => { ... }, [setOriginalImage, setOriginalCanvas, setResultCanvas, showToast]);`
  - Purpose: The primary ingestion orchestrator.
  - Working: Enforces file size limits, wraps the async loading logic in a try/catch block, and propagates results or errors back to the UI via the global `showToast` utility.


## 7. Points To Consider

- **Size Constraint**: The 5MB limit is an "Interaction Guard." While the engine can handle larger files, 5MB is the soft cap to prevent VRAM allocation failures during subsequent AI inference passes.

- **State Sync Invariant**: This hook always clears the `resultCanvas`. This is the primary mechanism that resets the `Workspace` UI when a user switches images.

- **Memory Cleanup**: Since `loadImage` revokes its object URLs, this hook is memory-safe for long sessions involving hundreds of image swaps.

- **Format Assumption**: The hook relies on the browser's native `Image` decoder; any format the browser can render (PNG, JPG, WebP, AVIF) is compatible.
