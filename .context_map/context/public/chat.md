# Context Map: chat.css

## Purpose
Defines the visual identity for the browser-native chat interface. Implements a premium, glassmorphic aesthetic to distinguish the conversational AI workspace from the standard image processing panels.

## Imports
- Uses CSS custom properties defined in `main.css`.

## Dependencies
- **Used by**:
  - `index.html`: Loaded via `<link>` (L7).
  - `src/main.js`: Controls visibility of the chat UI.
- **Uses**:
  - Google Fonts (Inter) and global design tokens.

## Project Flow Connection
- **Visual Feedback**: Provides the layout for streaming LLM tokens (`.typing` animation).
- **Glassmorphism**: Uses `backdrop-filter: blur(12px)` (L27) to create a layered, modern UI feel.
- **Responsive Layout**: Uses flexbox to ensure the message containers adapt to varying text lengths.

## File Code Structure

**`.chat-container`** (L6-16): Root flexbox layout with custom entrance animation.

**`.chat-output`** (L24-40): The primary scrolling area using glassmorphism styling.

**`.chat-input-area`** (L61-69): Interactive element with `focus-within` transitions (L71-73).

**`.message`** (L90-118): Dynamic components for `user`, `assistant`, and `system` message variations.

**`@keyframes`** (L18, L99, L168): Micro-animations for viewport entry and typing indicators.

## Code Details

**`.chat-output` block** (L24-40): Implements `backdrop-filter: blur(12px)` and a custom semi-transparent background to achieve the glass effect.

**`.message.user` and `.message.assistant` classes** (L104-118): Use `align-self` and unique `border-left` colors (Amber for user, Green for assistant) to create a clear conversational flow.

**`typing::after` pseudo-element** (L158-166): Creates a 3-dot animated indicator using a single node and the `box-shadow` trick to minimize DOM overhead.

**`@keyframes chatReveal`** (L18-21): A simple `translateY` and `opacity` transition applied to the root container to prevent jarring UI switches.
