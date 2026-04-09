# Context Map: ControlPanel.jsx


## 1. Purpose

The dynamic configuration interface for the application. It provides service-specific controls (sliders, dropdowns, buttons) based on the currently active AI tool. It manages local UI state for processing parameters and serves as the primary trigger for the main-thread "Process" action.


## 2. Imports

- **React**:
  - Syntax: `import React, { useState, useEffect } from 'react';`
  - Purpose: Tracks local parameter values and responds to global service changes.

- **useApp**:
  - Syntax: `import { useApp } from '../context/AppContext';`
  - Purpose: Subscribes to the `currentService` to determine which controls to render.

- **useSAM**:
  - Syntax: `import { useSAM } from '../hooks/useSAM';`
  - Purpose: Specialized hook for brush-based selection logic (Brush-to-Box derivation).


## 3. Dependencies

- **Used by**:
  - `App.jsx` (As the right-side configuration panel in the flex layout).

- **External APIs**:
  - **Browser DOM**: Standard HTML input elements (range, select, button).


## 4. State Management

- **values (State)**:
  - Syntax: `const [values, setValues] = useState({});`
  - Purpose: A local dictionary storing the current parameters for the active service (e.g., `{ threshold: 0.5, scale: 2 }`).


## 5. Project Flow

1. **Service Synchronization**: When `currentService` changes, an `useEffect` hook resets the `values` state to the defaults defined for that specific tool.

2. **Parameter Update**: User interacts with a slider or dropdown. `handleChange` updates the local `values` state.

3. **Validation**: The "Process" button is enabled/disabled based on service requirements (e.g., SAM requires at least one point).

4. **Trigger**: User clicks "🎨 Paint & Select". If the service is SAM, it invokes `executeSmartSelect`; otherwise, it passes the local `values` to the `onProcess` prop.


## 6. Code Structure

- **handleProcess (Function)**:
  - Syntax: `const handleProcess = () => { ... };`
  - Purpose: High-level action router.
  - Working: Branching logic that determines if the process should use the specialized SAM execution path or the generic service path.

- **Sync Defaults (Effect Hook)**:
  - Syntax: `useEffect(() => { ... }, [currentService]);`
  - Purpose: Ensures the UI matches the service context.
  - Working: Identifies the active service ID and populates the `values` state with sensible defaults (e.g., standard 2x scaling for upscaling).

- **renderServiceSpecific (Function)**:
  - Syntax: `const renderServiceSpecific = () => { ... };`
  - Purpose: The dynamic UI engine.
  - Working: A massive switch statement that returns different JSX fragments based on `currentService.id`. It renders model selectors for Background Removal, a Brush Size slider for SAM, and scale/intensity sliders for Upscaling.


## 7. Points To Consider

- **Defaults Invariant**: Every service added to the application must have an entry in the `useEffect` defaults and the `renderServiceSpecific` switch, or it will display a fallback "No specialized settings" message.

- **Button Invariant**: For object-segmentation, the main button text is dynamically changed to "🎨 Paint & Select" to guide the user toward the brush-painting workflow.

- **Parameter Passthrough**: The `values` object is passed directly to the `process` function in `useProcessor`. The keys in this object MUST match the option keys expected by the service's `processor.js`.

- **Component Isolation**: The `ControlPanel` does not know *how* to process images; it only knows how to *collect parameters* and signal the parent to start the work.
