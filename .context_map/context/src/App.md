# Context Map: App.jsx


## 1. Purpose

The root component and layout orchestrator of the application. It defines the visual skeleton (Header, Sidebar, Workspace, ControlPanel) and handles top-level routing between the standard interactive workspace and the AI Chat interface.


## 2. Imports

- **React**:
  - Syntax: `import React from 'react';`
  - Purpose: Core library for component definition.

- **Sidebar**:
  - Syntax: `import Sidebar from './components/Sidebar';`
  - Purpose: Navigation component for service selection.

- **Workspace**:
  - Syntax: `import Workspace from './components/Workspace';`
  - Purpose: Central stage for image rendering and interactions.

- **ControlPanel**:
  - Syntax: `import ControlPanel from './components/ControlPanel';`
  - Purpose: Service-specific settings and processing triggers.

- **ChatInterface**:
  - Syntax: `import ChatInterface from './components/features/ChatInterface';`
  - Purpose: Specialized full-screen conversational view for the Chat service.

- **useApp**:
  - Syntax: `import { useApp } from './context/AppContext';`
  - Purpose: Accesses global state for current service and UI feedback (toasts).

- **useProcessor**:
  - Syntax: `import { useProcessor } from './hooks/useProcessor';`
  - Purpose: Bridge to AI execution logic for the global "Process" action.


## 3. Dependencies

- **Used by**:
  - `main.jsx` (Rendered as the primary root component).

- **External APIs**:
  - **Browser DOM**: Used for standard layout and element rendering.


## 4. State Management

- **currentService (Destructured State)**:
  - Syntax: `const { currentService, toast, resetWorkspace, resultCanvas } = useApp();`
  - Purpose: Used to determine display titles, descriptions, and conditional rendering of the Chat vs. Workspace views.

- **process (Destructured Hook)**:
  - Syntax: `const { process } = useProcessor();`
  - Purpose: The primary execution function passed to the ControlPanel.


## 5. Project Flow

1. **Mounting**: The component subscribes to the `AppContext` via `useApp`.

2. **Layout Partitioning**: Renders the global `<header>` and splits the screen into `<Sidebar>` and the `<main>` content area.

3. **View Switching**: Conditional logic checks `currentService.id`. If it is 'chat', it renders the `ChatInterface`; otherwise, it renders the `Workspace` + `ControlPanel` pair.

4. **Action Routing**: When the "Process" trigger is fired from the `ControlPanel`, `App` invokes the `process` function from the `useProcessor` hook.

5. **Feedback Loop**: Listens for `toast` state updates in the context to render transient notification popups.


## 6. Code Structure

- **App (Function/Component)**:
  - Syntax: `function App() { ... };`
  - Purpose: Main application layout logic.
  - Working: Uses a ternary operator to swap between the Chat and Image processing views. It also defines the "New Image" and "Download Result" global actions which interface directly with `resetWorkspace` and `canvas-utils`.

- **Download Handler (Inline Anonymous Function)**:
  - Syntax: `onClick={() => { ... import('./core/canvas-utils').then(...) }}`
  - Purpose: Handles the export of the `resultCanvas`.
  - Working: Uses a dynamic import of `canvas-utils` to keep the initial bundle small, then invokes `downloadCanvas` with a timestamped filename.


## 7. Points To Consider

- **Chat Isolation**: The Chat service is treated as a "Full Page" override within the `<main>` container, whereas all other services share the `Workspace` + `ControlPanel` layout.

- **Dynamic Navigation**: The UI labels (h1, p) are driven entirely by the `currentService` object properties, ensuring that the heading always matches the Sidebar selection.

- **Toast Persistence**: The toast notification is rendered at the root level of `App` to ensure it overlays all other components regardless of the active service.

- **Action Cleanup**: The "New Image" button invokes `resetWorkspace`, which triggers a global state purge in `AppContext`, effectively resetting the DOM via the child components' effects.
