# Context Map: AppContext.jsx


## 1. Purpose

The central state management hub for the application. It utilizes the React Context API to provide a "single source of truth" for image data, processing status, AI point selections, and current service configurations. It eliminates prop-drilling by encapsulating global side-effects like service switching and result persistence.


## 2. Imports

- **React**:
  - Syntax: `import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';`
  - Purpose: Foundation for context creation, state hooks, high-performance memoization, and persistent refs.

- **SERVICES / SERVICE_ORDER**:
  - Syntax: `import { SERVICES, SERVICE_ORDER } from '../config';`
  - Purpose: Imports the static registry to initialize default service state.


## 3. Dependencies

- **Used by**:
  - `main.jsx` (Wraps the entire app in `AppProvider`).
  - All UI Components (via the `useApp` hook).
  - All Business Logic Hooks (via the `useApp` hook).

- **External APIs**:
  - **React Context API**: Used for global state broadcasting.


## 4. State Management

- **currentService (State)**:
  - Syntax: `const [currentService, setCurrentService] = useState(SERVICES[SERVICE_ORDER[0]]);`
  - Purpose: Tracks the currently active AI tool selected by the user.

- **originalCanvas (State)**:
  - Syntax: `const [originalCanvas, setOriginalCanvas] = useState(null);`
  - Purpose: Stores the `HTMLCanvasElement` containing the unedited source image.

- **resultCanvas (State)**:
  - Syntax: `const [resultCanvas, setResultCanvas] = useState(null);`
  - Purpose: Stores the `HTMLCanvasElement` or `ImageBitmap` resulting from an AI operation.

- **isProcessing (State)**:
  - Syntax: `const [isProcessing, setIsProcessing] = useState(false);`
  - Purpose: Global flag to trigger loading overlays and disable concurrent actions.

- **progress (State)**:
  - Syntax: `const [progress, setProgress] = useState({ percent: 0, message: '' });`
  - Purpose: High-frequency update object for the visual status bar.

- **samPoints (State)**:
  - Syntax: `const [samPoints, setSamPoints] = useState([]);`
  - Purpose: Registry of positive/negative coordinate clicks for the SAM model.

- **serviceResults (State)**:
  - Syntax: `const [serviceResults, setServiceResults] = useState({});`
  - Purpose: A persistence map that caches results per service ID, allowing "hot-swapping" between tools without data loss.

- **toastTimeoutRef (Ref)**:
  - Syntax: `const toastTimeoutRef = useRef(null);`
  - Purpose: Manages toast auto-dismissal timers to prevent race conditions.


## 5. Project Flow

1. **Initialization**: `AppProvider` mounts at the root, initializing state from `config.js`.

2. **Data Intake**: When an image is ingested, `originalCanvas` is set, making the workspace visible.

3. **Action Routing**: Components call `selectService` to switch tools. The provider saves the current results into `serviceResults` before loading the next service's cached state.

4. **Inference Feedback**: AI hooks call `setIsProcessing` and `updateProgress`, which the provider broadcasts to the `Workspace` status bar.

5. **Resolution**: Final AI outputs are sent to `setResultCanvas`, triggering the result-sync effect in components.


## 6. Code Structure

- **AppContext (Internal)**:
  - Syntax: `const AppContext = createContext();`
  - Purpose: Instantiation of the low-level context object.

- **AppProvider (Function/Component)**:
  - Syntax: `export const AppProvider = ({ children }) => { ... };`
  - Purpose: The provider component that wraps the React tree.
  - Working: Maintains global state slices and provides memoized utility functions. It uses `useMemo` for the broadcasted context value to prevent unnecessary re-renders across the app.

- **selectService (Callback)**:
  - Syntax: `const selectService = useCallback((serviceId) => { ... }, [currentService.id, resultCanvas, segmentationResult, samPoints, serviceResults]);`
  - Purpose: Orchestrates service switching with state persistence.
  - Working: Snapshots the current service's result (Canvas/SAM points) into the `serviceResults` map, then hydrates the state for the `serviceId` being navigated to.

- **resetWorkspace (Callback)**:
  - Syntax: `const resetWorkspace = useCallback(() => { ... }, []);`
  - Purpose: Full state purge.
  - Working: Resets images, processing flags, and clears the `serviceResults` persistence map to return the app to its landing state.

- **useApp (Export/Hook)**:
  - Syntax: `export const useApp = () => { ... };`
  - Purpose: Custom consumer hook.
  - Working: Accesses the `AppContext`, providing a safety check to ensure it is used only within an `AppProvider` boundary.


## 7. Points To Consider

- **Persistence Invariant**: The `selectService` function is the only way to switch services while maintaining work. Directly calling `setCurrentService` will bypass the result-caching logic.

- **Canvas vs. Bitmap**: The `resultCanvas` state can hold both `HTMLCanvasElement` (for native tools) and `ImageBitmap` (for worker outputs). Consumers must validate the type before direct manipulation.

- **Context Optimization**: The `contextValue` is memoized using `useMemo` to ensure that only components consuming truly changed state slices will trigger a re-render, significantly improving performance as the app grows.

- **The "Source of Truth" Trap**: Business logic should never maintain local copies of image data; always read from the context to ensure the `Workspace` and `ControlPanel` are visually synchronized.
