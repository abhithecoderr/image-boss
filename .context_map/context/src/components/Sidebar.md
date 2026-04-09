# Context Map: Sidebar.jsx


## 1. Purpose

The primary navigation and service-orchestration component. It renders the vertical list of available AI tools, highlights the active selection, and triggers the context-level "Service Switch" logic.


## 2. Imports

- **React**:
  - Syntax: `import React from 'react';`
  - Purpose: Functional component definition.

- **useApp**:
  - Syntax: `import { useApp } from '../context/AppContext';`
  - Purpose: Accesses the `selectService` callback and the current active service state.

- **SERVICE_ORDER / SERVICES**:
  - Syntax: `import { SERVICE_ORDER, SERVICES } from '../config';`
  - Purpose: Source data for rendering the navigation list and icons.


## 3. Dependencies

- **Used by**:
  - `App.jsx` (As the static left-side navigation rail).


## 4. State Management

- **currentService (Destructured State)**:
  - Syntax: `const { currentService, selectService } = useApp();`
  - Purpose: Used to apply the `.active` CSS class to the currently selected nav item.


## 5. Project Flow

1. **Generation**: The sidebar maps over the `SERVICE_ORDER` registry from the global configuration.

2. **Filtering**: It checks the `.disabled` property of each service to hide tools that are under development (e.g., Style Transfer).

3. **Interaction**: When a user clicks a service button, `selectService(id)` is called.

4. **Feedback**: The global state updates, causing the sidebar to re-render and move the active indicator to the new selection.


## 6. Code Structure

- **Sidebar (Function/Component)**:
  - Syntax: `const Sidebar = () => { ... };`
  - Purpose: Navigation layout logic.
  - Working: A simple iterator that renders a list of `<button>` elements. It pulls the `icon` and `name` directly from the `SERVICES` registry to ensure UI consistency with the configuration file.


## 7. Points To Consider

- **Disabled State Trap**: The sidebar includes a guard `if (service.disabled) return null;`. This is the primary way to turn off a service throughout the entire UI.

- **Identity Invariant**: The service `id` used in the `onClick` handler MUST match the keys in the `SERVICES` object and the IDs expected by `AppContext.selectService`.

- **Visual Consistency**: Icons are stored as emojis or SVG strings in the `config.js`. The sidebar is responsible for wrapping these in an `.icon` container for layout alignment.
