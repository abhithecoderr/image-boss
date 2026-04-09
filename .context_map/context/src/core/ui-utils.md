# Context Map: ui-utils.js


## 1. Purpose

A library of imperative UI helpers that bridge the gap between AI logic and user feedback. It provides declarative-style DOM creation for legacy modules, triggers transient toast notifications, handles high-frequency progress bar updates, and manages asynchronous button loading states to maintain UX responsiveness during long AI inference runs.


## 2. Imports

- **Non-Standard**: This is a pure utility library and does not depend on external JavaScript imports.


## 3. Dependencies

- **Used by**:
  - `App.jsx` (For rendering toasts).
  - `Workspace.jsx` (For status bar updates).
  - All feature modules that require dynamic DOM generation or UX feedback.

- **External APIs**:
  - **Browser DOM API**: Used for all element creation and manipulation.
  - **requestAnimationFrame**: Used for smooth entry/exit animations of UI elements.


## 4. State Management

- **Non-Standard**: This is a stateless utility module. It manipulates the DOM directly and uses transient variables for timeouts and animations.


## 5. Project Flow

1. **Trigger**: An AI process or user action initiates a feedback requirement (e.g., "Started Background Removal").

2. **Ingestion**: Utility functions like `showToast` or `updateProgress` are called with relevant metadata.

3. **DOM Synthesis**: The module creates or selects relevant UI elements (like `.toast` or `.progress-fill`).

4. **UX Realization**: Transitions are triggered via CSS classes (`.show`) and JS-calculated widths/text contents.

5. **Cleanup**: Transient elements (toasts) are removed from the DOM after their duration expires to prevent memory bloat.


## 6. Code Structure

- **createElement (Function)**:
  - Syntax: `export function createElement(tag, attrs = {}, children = []) { ... }`
  - Purpose: A lightweight, declarative wrapper for `document.createElement`.
  - Working: Initializes an element, iterates over an attributes map to handle `className`, `style` objects, and event listeners (prefixed with 'on'), and recursively appends children strings or nodes.

- **showToast (Function)**:
  - Syntax: `export function showToast(message, type = 'info', duration = 3000) { ... }`
  - Purpose: Displays a transient notification.
  - Working: Creates a styled div, appends it to `document.body`, uses `requestAnimationFrame` to ensure the `.show` class triggers the enter transition, and sets a `setTimeout` to remove the element after the specified duration.

- **formatFileSize (Function)**:
  - Syntax: `export function formatFileSize(bytes) { ... }`
  - Purpose: Human-readable byte formatting.
  - Working: Uses a logarithmic scale to determine the appropriate unit (B, KB, MB, GB) and returns a fixed-precision float combined with the unit label.

- **updateProgress (Function)**:
  - Syntax: `export function updateProgress(element, progress, message = '') { ... }`
  - Purpose: High-frequency status bar synchronization.
  - Working: Queries the target container for internal fill and text nodes, updates the CSS `width` percentage for the bar, and sets the `textContent` for the status message.

- **setButtonLoading (Function)**:
  - Syntax: `export function setButtonLoading(button, loading) { ... }`
  - Purpose: Manages processing state on interactive elements.
  - Working: Toggles the `disabled` attribute, preserves the original text in `dataset.originalText`, and injects a spinner icon during the active loading state.


## 7. Points To Consider

- **DOM Bloat Trap**: Elements created via `createElement` or `showToast` MUST be cleaned up. The `showToast` function handles this automatically via a nested timeout.

- **className Invariant**: When using `createElement`, always use the key name `className` rather than `class` to maintain consistency with React and internal property mapping.

- **Animation Sync**: Always use `requestAnimationFrame` when applying CSS-based animations immediately after adding an element to the DOM. Without this, the browser may batch the styles, causing the transition to skip the initial state.

- **Performance**: `updateProgress` is often called in 100ms intervals from Workers. Ensure the DOM queries (`querySelector`) are performed on localized elements to minimize search costs.
