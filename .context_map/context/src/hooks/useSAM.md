# Context Map: useSAM.js


## 1. Purpose

A specialized business logic hook for the Segment Anything Model (SAM). It manages the collection of user-defined selection points (via right-click refinement) and provides the "Brush-to-Box" derivation logic that converts rough paint strokes into high-precision AI prompts.


## 2. Imports

- **React**:
  - Syntax: `import { useCallback } from 'react';`
  - Purpose: Memoizes the point management functions to prevent unnecessary re-renders of the interactive overlay.

- **useApp**:
  - Syntax: `import { useApp } from '../context/AppContext';`
  - Purpose: Tracks the list of points, the current point label (include/exclude), and the final segmentation result.

- **useProcessor**:
  - Syntax: `import { useProcessor } from './useProcessor';`
  - Purpose: Provides the `process` function used to send point bundles to the AI worker.


## 3. Dependencies

- **Used by**:
  - `SAMOverlay.jsx` (For adding points via mouse clicks).
  - `ControlPanel.jsx` (For clearing selection or choosing point types).
  - `SegmentationCandidates.jsx` (Implicitly, as its result drives this UI).

- **External APIs**:
  - None.


- **brushCanvasRef (Ref)**:
  - Syntax: `const brushCanvasRef = useRef(null);`
  - Purpose: Connects the hook to the UI's painting layer for raw pixel analysis.

- **brushBoxRef (Ref)**:
  - Syntax: `const brushBoxRef = useRef(null);`
  - Purpose: Persists the bounding box derived from the brush stroke to enable refinement clicks within the same context.


### 1. Selection
- **Flow**: User clicks on the image. `SAMOverlay` calls `addPoint`, which updates the context's `samPoints` array.
- **Files Involved**:
  - `SAMOverlay.jsx`: Captures raw mouse coordinates and normalizes them.
  - `AppContext.jsx`: Stores the persistent array of selection coordinates.

### 2. Categorization
- **Flow**: The `samPointLabel` (1 for Positive, 0 for Negative) determines the semantic meaning of the next click.
- **Files Involved**:
  - `AppContext.jsx`: Manages the global selection mode (Include/Exclude).

### 3. Packaging
- **Flow**: When "Extract" is clicked, `executeSmartSelect` bundles the normalized coordinates into an options object.

### 4. Inference
- **Flow**: The bundled points are sent to `useProcessor.process`, which delegates to the SAM worker.
- **Files Involved**:
  - `useProcessor.js`: Orchestrates the async bridge to the object-segmentation service.

### 5. Resolution
- **Flow**: The returned `MaskCandidate` results are committed to `setSegmentationResult`, making them available for user selection.
- **Files Involved**:
  - `AppContext.jsx`: Mounts the AI-generated subject candidates into the UI Rail.


## 6. Code Structure

- **addPoint (Callback)**:
  - Syntax: `const addPoint = useCallback((x, y, isRefining) => { ... }, [samPointLabel, setSamPoints]);`
  - Purpose: Adds a coordinate to the active selection.
  - Working: If `isRefining` is false, it resets the array to a single point (Atomic Selection). If true, it appends the new point to the list (Refining Selection).

- **clearPoints (Callback)**:
  - Syntax: `const clearPoints = useCallback(() => { ... }, [setSamPoints]);`
  - Purpose: Resets the interactive state.
  - Working: Sets `samPoints` to an empty array.

- **onBrushComplete (Callback)**:
  - Syntax: `const onBrushComplete = useCallback(async (brushCanvas) => { ... }, [...]);`
  - Purpose: High-level AI trigger for the brush flow.
  - Working: Invokes `deriveBBoxAndPoints`, updates the `samPoints` state with sampled pixels, and sends the bundled `box` and `points` to the processor.

- **deriveBBoxAndPoints (Internal Function)**:
  - Syntax: `function deriveBBoxAndPoints(brushCanvas) { ... }`
  - Purpose: The "Vision Interpreter" for the brush.
  - Working: Scans the brush canvas alpha channel to find pixel extremities (Bounding Box) and samples ~8 evenly distributed coordinates within the painted area as positive prompts.


## 7. Points To Consider

- **Atomic vs. Multi-Point**: The `isRefining` flag (usually driven by the Shift key) is the difference between selecting a *brand new* object and *adding to* an existing selection.

- **Label Invariant**: SAM expects `label: 1` for inclusions and `label: 0` for exclusions. The hook ensures these integers are correctly attached to the coordinate metadata before inference.

- **Zero-Point Guard**: The hook includes an early return with an "info" toast if the user tries to process without any points, preventing redundant worker calls.

- **Coordinate Source**: Points are assumed to be normalized (0..1) or matched to the original canvas scale by the calling component (`SAMOverlay`) before being stored here.
