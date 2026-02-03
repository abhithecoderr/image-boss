# Context Map: main.css

## Purpose
The primary stylesheet for Image Boss. Establishes the global design system, including Typography, Color Palettes (Dark Theme), Spacing, and Component primitives used across the entire application.

## Imports
- No external CSS imports. (Google Fonts are loaded in `index.html`).

## Dependencies
- **Used by**:
  - `index.html`: Primary style entry point.
  - `chat.css`: Inherits design tokens via `:root`.
- **Uses**: None.

## Project Flow Connection
- **Design Credits**: Defines the "Premium" look using HSL-tailored dark modes and subtle gradients.
- **UI State**: Provides utility classes like `.hidden` (L205) and `.active` (L454) used by `main.js` to manage session flow.
- **Hardware Acceleration**: Optimized for high-fidelity rendering on GPU-accelerated browsers.

## File Code Structure

**`:root` Tokens** (L9-66): Centralized design system (Colors, Shadows, Spacing, Radius, Transitions).

**Reset & Base** (L71-95): Global browser normalization and typography defaults.

**Navigation** (L100-190): Styles for the service-switcher and branding.

**Layout Components** (L195-394): Styles for `#main`, `.status-bar`, `.upload-area`, and the side-by-side `.workspace`.

**Tool-Specific UI** (L396-490): Controls, overlays, and brush previews.

**Global Elements** (L500-591): Generic buttons, spinners, and toast notifications.

**Model-Specific Overlays** (L594-814): Layer pickers (SAM 2), click indicators, and comparison sliders.

## Code Details

**`:root` variables** (L9-66): Uses descriptive names like `--bg-elevated` and `--highlight` to ensure thematic consistency across different UI modules.

**`.preview-image-wrapper` block** (L355-371): Implements a 20px checkerboard pattern using layered `linear-gradient` backgrounds (L364-370). Essential for visualizing transparency in background removal and segmentation tasks.

**`.progress-fill` animation** (L244-250): Uses a `linear-gradient` and `transition: width var(--transition-normal)` to provide smooth, non-jittery progress updates during AI inference.

**`.btn-primary` hover state** (L527-531): Combines `transform: translateY(-1px)` and `box-shadow` to create a "lifted" interactive feel for primary actions.

**`.comparison-container` cursor** (L791-800): Uses `cursor: ew-resize` to signal the interactive split-pane nature of the result comparison tool.
