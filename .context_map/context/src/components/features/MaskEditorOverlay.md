# Context Map: MaskEditorOverlay.jsx


## 1. Purpose

The interactive drawing surface for manual mask refinement. It overlays the result canvas and provides the mouse/touch event listeners required to drive the `useMaskEditor` hook. It renders the visual feedback for the user's brush strokes during "Erase" and "Restore" operations.


## 2. Imports

- **React**:
  - Syntax: `import React from 'react';`
  - Purpose: Functional component definition.

- **useApp**:
  - Syntax: `import { useApp } from '../../context/AppContext';`
  - Purpose: Accesses the global `editing` state to determine if the cursor should be visible.

- **useMaskEditor**:
  - Syntax: `import { useMaskEditor } from '../../hooks/useMaskEditor';`
  - Purpose: Primary business logic hook that handles the actual pixel manipulation on the backing buffer.


## 3. Dependencies

- **Used by**:
  - `Workspace.jsx` (Mounted as an interactive overlay when a result is present).


## 4. State Management

- **editing (Destructured Hook State)**:
  - Syntax: `const { startDrawing, moveDrawing, endDrawing, activeTool, brushSize } = useMaskEditor(resRef);`
  - Purpose: Captures the mouse-handling functions and tool configuration from the hook.


## 5. Project Flow

1. **Activation**: The overlay becomes active when `activeTool` is set to something other than 'none'.

2. **Capture**: The component binds `onMouseDown`, `onMouseMove`, and `onMouseUp` to the `useMaskEditor` lifecycle.

3. **Coordinate Stream**: Mouse coordinates are passed to the hook, where they are scaled and applied to the hidden edit buffer.

4. **Visual Sync**: The hook triggers a re-composite on the `resRef` canvas, which sits directly beneath this transparent overlay.


## 6. Code Structure

- **MaskEditorOverlay (Function/Component)**:
  - Syntax: `const MaskEditorOverlay = ({ resRef }) => { ... };`
  - Purpose: The interactive event-listening layer.
  - Working: Renders a transparent `div` that covers the entire workspace. It uses a dynamic `cursor` style that calculates a circular CSS `radial-gradient` to represent the brush size and tool type to the user.


## 7. Points To Consider

- **The "Hit-Box" Invariant**: This component must be top-level within the Workspace stack to capture mouse events. If other overlays (like SAM) are mounted above it, the mask editor will fail to receive clicks.

- **Cursor Feedback**: The brush size is visualized using an inline `style` that transforms the `brushSize` into a CSS variable. This allows the user to see exactly where they are painting before they click.

- **ResRef Dependency**: Unlike most components, this overlay *requires* the `resRef` from the parent `Workspace` to be passed as a prop, as it needs to signal the hook on which physical canvas to perform the compositing.

- **Pointer Capture**: The component uses `onMouseLeave` to trigger `endDrawing` to prevent the brush from getting "stuck" in a drawing state if the user drags their mouse out of the workspace bounds.
