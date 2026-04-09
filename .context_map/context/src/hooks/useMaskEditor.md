# Context Map: useMaskEditor.js


## 1. Purpose

The coordination hook for manual mask refinement (Erase/Restore). it manages a hidden "edit buffer" canvas, handles mouse manipulation for coordinate scaling, and orchestrates the compositing operations that combine the original image with the edited mask in real-time.


## 2. Imports

- **React**:
  - Syntax: `import { useCallback, useRef, useEffect } from 'react';`
  - Purpose: Uses `useRef` for the persistent edit buffer and `useEffect` for state synchronization.

- **useApp**:
  - Syntax: `import { useApp } from '../context/AppContext';`
  - Purpose: Accesses the current service and active editing toolset (brush size, tool type).


## 3. Dependencies

- **Used by**:
  - `MaskEditorOverlay.jsx` (For mouse event mapping and brush updates).
- **Uses**:
  - `originalCanvas` as the "Restore" pattern source.

- **External APIs**:
  - **Canvas API (Composite Operations)**: Specifically `destination-out` and `source-over`.
  - **getBoundingClientRect**: For coordinate normalization between the visual DOM and the backing pixel buffer.


## 4. State Management

- **maskCanvasRef (Ref)**:
  - Syntax: `const maskCanvasRef = useRef(null);`
  - Purpose: Holds the "True Mask" buffer. This is a non-visible canvas that persists the user's manual strokes.

- **editing (Destructured State)**:
  - Syntax: `const { editing, setEditing, ... } = useApp();`
  - Purpose: Tracks activeTool ('erase'/'restore'), brushSize, and isDrawing status.


## 5. Project Flow

### 1. Initialization
- **Flow**: When a result appears, `useEffect` copies it to the `maskCanvasRef` to create an editable clone.
- **Files Involved**:
  - `AppContext.jsx`: Providing the `resultCanvas` source for the edit buffer.

### 2. Interaction
- **Flow**: User moves the mouse. `drawAt` calculates the coordinate relative to the image's internal resolution.

### 3. Pixel Manipulation
- **Flow**: Strokes use `destination-out` (Erase) or `CanvasPattern` (Restore) to modify the mask.
- **Files Involved**:
  - `AppContext.jsx`: Providing the `originalCanvas` for pixel restoration patterns.

### 4. Synchronization
- **Flow**: `updateDisplay` is called after every stroke to re-composite the mask with the original image on the workspace canvas.


## 6. Code Structure

- **Mask Canvas Initialization (Effect Hook)**:
  - Syntax: `useEffect(() => { ... }, [resultCanvas]);`
  - Purpose: Creates the persistent edit buffer.
  - Working: If a `resultCanvas` exists and no buffer is initialized, it creates a new off-screen canvas of matching dimensions and clones the result pixels into it.

- **updateDisplay (Callback)**:
  - Syntax: `const updateDisplay = useCallback(() => { ... }, [originalCanvas, currentService, resRef]);`
  - Purpose: High-performance visual compositing.
  - Working: Renders the edit buffer directly for non-transparent services (Blur/Upscale), or performs a `destination-in` composite of the original image against the mask for background removal services.

- **drawAt (Callback)**:
  - Syntax: `const drawAt = useCallback((clientX, clientY) => { ... }, [editing.activeTool, editing.brushSize, originalCanvas, updateDisplay, resRef]);`
  - Purpose: Coordinate translation and stroke application.
  - Working: Multiplies the mouse event coordinates by the ratio of `canvas.width / rect.width` to ensure the brush hits the correct pixels even if the image is zoomed or scaled.

- **Mouse Handlers (Callbacks)**:
  - Syntax: `startDrawing`, `moveDrawing`, `endDrawing`.
  - Purpose: Lifecycle of a manual stroke.


## 7. Points To Consider

- **Coordinate Scaling Trap**: Never assume mouse coordinates match pixel coordinates. The `scaleX` calculation is mandatory because browser CSS resizing and high-DPI displays create a mismatch between visual pixels and buffer pixels.

- **Pattern Restoration**: The "Restore" tool doesn't just paint color; it paints a pattern created from the `originalCanvas`. This is what allows users to "un-blur" or "un-remove" specific parts of an image.

- **The Initialization Invariant**: The mask editor is an "Post-Processing" tool. It only activates once a `resultCanvas` exists. Re-running an AI tool will overwrite the manual edits unless they are explicitly saved back to the context.

- **Display Sync**: Manual edits happen on the `resRef` DOM canvas for performance, but they are not automatically synchronized to the global `resultCanvas` state until `endDrawing` is called or a explicit "Save" is triggered.
