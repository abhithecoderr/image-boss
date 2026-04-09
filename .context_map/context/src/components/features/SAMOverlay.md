# Context Map: SAMOverlay.jsx


## 1. Purpose

The interactive input layer for Segment Anything (SAM). It provides a brush-based painting interface that allows users to roughly outline a subject. It tracks mouse gestures to visualize strokes and triggers the "Brush-to-Box" inference flow upon completion.


## 2. Imports

- **React**:
  - Syntax: `import React from 'react';`
  - Purpose: Functional component definition.

- **useSAM**:
  - Syntax: `import { useSAM } from '../../hooks/useSAM';`
  - Purpose: Manages the point addition logic and point type categorization.


## 3. Dependencies

- **Used by**:
  - `Workspace.jsx` (Mounted when the 'object-segmentation' service is active).


- **canvasRef (Ref)**:
  - Syntax: `const canvasRef = useRef(null);`
  - Purpose: Houses the high-frequency painting logic for brush visualization without triggering React re-renders.

- **isDrawingRef (Ref)**:
  - Syntax: `const isDrawingRef = useRef(false);`
  - Purpose: Tracks the mouse button state for painting gestures across the component boundary.


## 5. Interaction Flow

### 1. Canvas Sync
- **Flow**: The overlay dimensions and its internal painting `<canvas>` are automatically synced to the `srcRef` (Source Image).

### 2. Stroke Capture
- **Flow**: `handleMouseDown` and `handleMouseMove` draw semi-transparent blue strokes onto the internal canvas.

### 3. Inference Trigger
- **Flow**: `handleMouseUp` (or window mouseup) stops the gesture and calls `onBrushComplete()`, passing the painted canvas for algorithmic analysis.

### 4. Right-Click Refinement
- **Flow**: Right-clicking ignores the brush and falls back to `addPoint()` for legacy inclusion/exclusion markers.


## 6. Code Structure

- **handleClick (Function)**:
  - Syntax: `const handleClick = (e) => { ... };`
  - Purpose: Coordinate translation logic.
  - Working: Uses `getBoundingClientRect` on the container to determine the local X/Y. It checks `e.shiftKey` to toggle between atomic and refining selection modes.

- **Marker Mapping (JSX Block)**:
  - Syntax: `{samPoints.map((point, i) => ( ... ))}`
  - Purpose: Renders the visual point indicators.
  - Working: Injects a `style` with `top` and `left` as percentages (`point.y * 100%`) so that the markers stay synced with the image even if the browser window is resized.


## 7. Points To Consider

- **Coordinate Normalization Invariant**: All points must be stored as percentages (0..1). This allows the SAM processor to scale them to the model's internal input size (e.g., 1024x1024) regardless of the display resolution.

- **The Shift-Key Protocol**: This is the primary UX for multi-point selection. Without holding Shift, every click resets the selection, which is the expected "Auto-Select" behavior for casual users.

- **Z-Index Handling**: Markers must have a high `z-index` to remain visible above both the source image and any active result canvases.

- **Visual Feedback**: Positive points (label: 1) are green, and Negative points (label: 0) are red. This semantic coloring is handled via dynamic CSS classes based on the `point.label` property.
