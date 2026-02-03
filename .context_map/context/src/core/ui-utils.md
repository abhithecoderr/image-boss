# Context Map: ui-utils.js

## Purpose
Collection of reusable UI helpers for DOM manipulation, user notifications, and state feedback. Designed to standardize how elements are created and updated across the application without relying on heavy frameworks.

## Imports
- No external imports (Browser native APIs only)

## Dependencies
- **Used by**:
  - `main.js`: Primary consumer for toast notifications, progress updates, and button states
  - `canvas-utils.js`: (Indirectly) for element creation if necessary
- **Uses**:
  - `document.createElement`, `requestAnimationFrame`, `setTimeout` (Native APIs)

## Project Flow Connection
- **Feedback Loop**: `showToast` provides immediate visual confirmation of errors or successes.
- **Async Execution**: `updateProgress` and `setButtonLoading` manage the interface state during heavy AI model inference.
- **DOM Construction**: `createElement` provides a declarative pattern for building dynamic UI components.

## File Code Structure

**`createElement(tag, attrs, children)`** (L9-33): Custom factory function that handles standard attributes, `className`, nested styles, and `on` event listeners.

**`showToast(message, type, duration)`** (L38-52): Generates and animates a floating notification using `requestAnimationFrame` for smooth entry (L46).

**`formatFileSize(bytes)`** (L57-63): Mathematical utility to convert raw byte sizes into human-readable strings (KB, MB, etc.).

**`updateProgress(element, progress, message)`** (L68-80): Standardized way to update the `#status-bar` progress fill and text.

**`setButtonLoading(button, loading)`** (L85-94): Toggle utility that disables buttons and injects a spinner during processing, restoring original text upon completion.

**`debounce(fn, delay)`** (L99-105): Standard closure-based debounce implementation to limit high-frequency function calls.

## Code Details

**`function createElement()`** (L12-30): Nested `for...of` iteration using `Object.entries(attrs)`. Includes an `if (name.startsWith('on'))` block (L17) for `addEventListener` and recursively handles `Array` children via `children.forEach` (L26).

**`function showToast()`** (L38-52): Animates via `requestAnimationFrame` (L46). Includes a `setTimeout` cleanup (L50) that executes `toast.remove()` precisely at `duration + 300ms` to account for `opacity` CSS transitions.

**`function formatFileSize()`** (L61): Scale calculation using `const i = Math.floor(Math.log(bytes) / Math.log(1024))`. Indexes into `const sizes` (L58) to return a string localized via `.toFixed(1)`.

**`function setButtonLoading()`** (L85-94): Toggle logic using `button.disabled = loading`. Caches `button.innerHTML` into `button.dataset.originalText` (L88) to perform bit-safe restoration during the `else` branch (L91).
