# Context Map: ComparisonSlider.jsx


## 1. Purpose

A high-performance interactive overlay for before/after image comparisons. It allows users to drag a vertical divider across the workspace to reveal the AI-processed result (e.g., upscaled or restored pixels) relative to the original source.


## 2. Imports

- **React**:
  - Syntax: `import React, { useState, useRef, useEffect } from 'react';`
  - Purpose: Manages the slider position percentage and handles mouse/touch events.


## 3. Dependencies

- **Used by**:
  - `Workspace.jsx` (Mounted as an overlay for specific "Comparison-Heavy" services).

- **External APIs**:
  - **Browser Mouse/Touch Events**: For real-time position tracking.


## 4. State Management

- **position (State)**:
  - Syntax: `const [position, setPosition] = useState(50);`
  - Purpose: The horizontal percentage (0 to 100) of the divider's location.

- **isDragging (State)**:
  - Syntax: `const [isDragging, setIsDragging] = useState(false);`
  - Purpose: Tracks active user interaction to enable/disable coordinate tracking.


### 1. Initialization
- **Flow**: Component mounts with the divider at the center (50%).

### 2. Capture
- **Flow**: User clicks and holds the slider handle. `onMouseDown` sets `isDragging` to true.

### 3. Tracking
- **Flow**: calculates the relative X position within its container and updates the `position` state.

### 4. Visual Masking
- **Flow**: The processed image is rendered in a container with its width or `clip-path` driven by the `position` percentage.
- **Files Involved**:
  - `Workspace.jsx`: Provides the parent context and dual-canvas layout for the comparison view.


## 6. Code Structure

- **moveSlider (Callback)**:
  - Syntax: `const moveSlider = (clientX) => { ... };`
  - Purpose: Coordinate translation logic.
  - Working: Uses `getBoundingClientRect` on the container to convert the absolute mouse X into a relative percentage. It clamps the value between 0 and 100 to prevent the slider from leaving the image bounds.

- **Event Listeners (Effect Hook)**:
  - Syntax: `useEffect(() => { ... window.addEventListener('mousemove', ... ) ... }, [isDragging]);`
  - Purpose: Provides global event tracking.
  - Working: When `isDragging` is true, it attaches listeners to the `window` objects. This allows the slider to follow the mouse even if the cursor moves faster than the React render loop or leaves the divider's hit-box.


## 7. Points To Consider

- **The "Window-Level" Invariant**: Mouse move listeners MUST be attached to the `window` during the drag phase. If attached only to the slider div, the interaction will "break" if the user moves the mouse too quickly.

- **Container Sizing**: The slider relies on its parent being exactly the same size as the underlying image canvases. This is handled by the `Workspace` container's layout.

- **Touch Support**: To maintain mobile compatibility, the logic should ideally mirror `mousemove` events with `touchmove` events using the same `moveSlider` internal logic.

- **CSS Performance**: The reveal effect is most performant when using `overflow: hidden` on a child container or a CSS `clip-path`, as it avoids re-painting the entire image buffer.
