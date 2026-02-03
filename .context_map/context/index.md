# Context Map: index.html

## Purpose
Main entry point and UI structure for Image Boss. Defines the semantic HTML5 layout, including navigation, upload section, workspace, and global status markers.

## Imports
- **CSS**: `/main.css`, `/chat.css`
- **Fonts**: Google Fonts (Inter)
- **JS**: `/src/main.js` (Module)

## Dependencies
- **Used by**: Browser (Entry Point)
- **Uses**:
  - `main.js`: Dynamically populates `#nav-services`, `#controls`, and `#layers-container`
  - All style definitions for visual presentation

## Project Flow Connection
- **Initial State**: Shows `#upload-area`, hides `#workspace`.
- **Loading State**: Displays `#status-bar` with progress bar.
- **Active State**: Swaps `#upload-area` for `#workspace` upon successful image load.

## File Code Structure

**Head Section** (L1-13): Character set, viewport, metadata, and stylesheet links.

**Navigation** (L17-25): Branding and container for dynamic service buttons.

**Status Bar** (L30-35): Hidden progress indicator for AI model downloads/inference.

**Upload Area** (L38-46): Drop zone and hidden file input for initial image intake.

**Workspace** (L49-86): Central UI container revealed after image load.
- **Preview Panels** (L51-67): Side-by-side canvases for original vs result.
- **Layer Picker** (L70-73): Dynamic list for multi-object segmentation.
- **Controls** (L76-78): Placeholder for service-specific sliders and toggles.
- **Actions** (L81-85): Global buttons (New, Process, Download).

**Script Entry** (L90): Loads the main application module.

## Code Details

**`div#app` container** (L29-84): Root layout node implementing a `flexbox` sidebar design. Nested `main.main-content` (L60) manages the visibility of the `#workspace` vs `#upload-area`.

**`input#image-input` element** (L69): Hidden file input restricted by `accept="image/*"`. Managed via `addEventListener('change', ...)` in `main.js`.

**`div#status-bar` block** (L30-35): Multi-element node for progress tracking. Includes a `div.progress-fill` with dynamic inline `width` styles and a `div#status-text` for string injection.

**`canvas` elements** (L55, L61): Direct-access DOM nodes for original and processed image buffers. Interacted with via `CanvasRenderingContext2D` for all filtering and AI result rendering.
