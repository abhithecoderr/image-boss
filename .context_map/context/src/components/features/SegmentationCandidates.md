# Context Map: SegmentationCandidates.jsx


## 1. Purpose

The secondary UI layer for Segment Anything (SAM) results. When SAM returns multiple mask possibilities (e.g., "The Whole Shirt" vs "Just the Pocket"), this component renders them as interactive thumbnails, allowing the user to select their desired mask for extraction or removal.


## 2. Imports

- **React**:
  - Syntax: `import React from 'react';`
  - Purpose: Functional component definition.

- **useApp**:
  - Syntax: `import { useApp } from '../../context/AppContext';`
  - Purpose: Accesses the `segmentationResult` and `setResultCanvas` to commit the user's choice to the global workspace.


## 3. Dependencies

- **Used by**:
  - `Workspace.jsx` (Mounted when the AI returns multiple candidate masks).


## 4. State Management

- **segmentationResult (Destructured State)**:
  - Syntax: `const { segmentationResult, setResultCanvas } = useApp();`
  - Purpose: The source array of candidate canvases and the function to promote one to the active result.


## 5. Project Flow

1. **Detection**: The component becomes visible only when `segmentationResult` is not null and contains a `masks` array.

2. **Rendering**: Iterates over the candidates, rendering each mask as a small thumbnail in a horizontal scroll rail.

3. **Interaction**: User clicks a candidate thumbnail.

4. **Realization**: `setResultCanvas(mask.canvas)` is called, which triggers the visual workspace update and clears the candidate list.


## 6. Code Structure

- **SegmentationCandidates (Function/Component)**:
  - Syntax: `const SegmentationCandidates = () => { ... };`
  - Purpose: The candidate selection rail.
  - Working: Safeguards against empty results with an early return. It maps over `segmentationResult.masks`, rendering each with an `onClick` handler that updates the global workspace state.


## 7. Points To Consider

- **Selection Invariant**: Once a candidate is selected, it becomes the "active" mask. This triggers the `useMaskEditor` to initialize its edit buffer, allowing the user to begin manual refinement immediately.

- **Canvas Memory**: The candidates are usually provided as `OffscreenCanvas` or `HTMLCanvasElement` instances. Clicking one creates a reference in the global state, avoiding the need to re-generate the pixels.

- **Visual Clarity**: Since candidates can look similar, the thumbnails should ideally have a hover-effect or distinct borders to indicate which one is currently under the cursor.

- **Auto-Cleanup**: The component generally clears itself (via the `useApp` state) once a selection is made, moving the user's focus from "Selection" to "Refinement."
