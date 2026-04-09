# Context Map: useProcessor.js


## 1. Purpose

The primary business logic bridge between the React UI layer and the vanilla JS AI service layer. It manages the lifecycle of AI processors, including dynamic importing of service modules, worker initialization, progress tracking, and final result validation. It ensures that only one AI task is active at a time and provides centralized error handling for all AI operations.


## 2. Imports

- **React**:
  - Syntax: `import { useState, useCallback, useRef } from 'react';`
  - Purpose: Provides state management for execution status, memoization for the process function, and refs for processor singleton persistence.

- **useApp**:
  - Syntax: `import { useApp } from '../context/AppContext';`
  - Purpose: Connects the hook to the global application state for result storage and UI feedback.


## 3. Dependencies

- **Used by**:
  - `App.jsx` (Primary entry point for the "Process" button).
  - `useSAM.js` (For executing smart selection inference).
  - `useChat.js` (For executing local LLM generation).

- **External APIs**:
  - **Dynamic Import API**: Used for lazy-loading service processors from `../services/`.


## 4. State Management

- **processorRef (Ref)**:
  - Syntax: `const processorRef = useRef(null);`
  - Purpose: Stores a singleton instance of the current active AI processor. This prevents redundant model/worker initialization when the user clicks "Process" multiple times.


## 5. Project Flow

### 1. Trigger
- **Flow**: A UI component invokes the `process(options)` function.

### 2. Reset
- **Flow**: The hook immediately clears previous results to prevent UI artifacts.
- **Files Involved**:
  - `AppContext.jsx`: Invokes `setResultCanvas(null)` to clear the global output buffer.

### 3. Initialization
- **Flow**: It checks `processorRef`. If missing or service changed, it disposes of the old one and lazily imports the new processor via `loadProcessor`.
- **Files Involved**:
  - `services/`: Dynamically imports the `processor.js` for the selected AI service.

### 4. Execution
- **Flow**: The processor's `process` method is called, passing the `originalCanvas` and a progress callback.
- **Files Involved**:
  - `services/`: Executes the specific AI model workflow in a background thread.

### 5. Validation
- **Flow**: Once the AI returns, the hook validates that the output is a valid canvas or bitmap.

### 6. Realization
- **Flow**: The validated result is committed to the global state, and a success toast is displayed.
- **Files Involved**:
  - `AppContext.jsx`: Commits the result to the central image processing pipeline.


## 6. Code Structure

- **loadProcessor (Callback)**:
  - Syntax: `const loadProcessor = useCallback(async (serviceId) => { ... }, []);`
  - Purpose: Handles dynamic module resolution.
  - Working: Uses a template literal to import the `processor.js` from the specific service folder and returns the default export.

- **process (Callback)**:
  - Syntax: `const process = useCallback(async (options = {}) => { ... }, [originalCanvas, currentService, loadProcessor, setIsProcessing, updateProgress, setResultCanvas, showToast]);`
  - Purpose: The main orchestrator for AI tasks.
  - Working: Manages the `isProcessing` flag, initializes the UI status bar, handles the singleton lifecycle of the worker via `processorRef`, and performs final type-checking on the returned result before broadcasting it to the app.


## 7. Points To Consider

- **Singleton Persistence**: The `processorRef` is never cleared during a session unless the service changes. This is vital for "Hot Refinement" services that cache embeddings (like SAM) or models (like LLMs) for instant response.

- **Result Validation Invariant**: The hook includes a strict `isValidCanvas` check. This prevents the application from crashing if a misconfigured worker returns a raw buffer or an error object instead of a drawable canvas.

- **The "Model Switch" Guard**: When a model is switched, the hook explicitly calls `processor.dispose()` (if it exists) to release WebGPU/WASM memory before loading the new model.

- **Async Race Condition**: The hook clears `resultCanvas` at the start of `process`. This ensures that even if a long-running AI task is active, the user doesn't see stale data from the *previous* run if they adjust parameters and re-run.
