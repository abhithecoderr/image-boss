# Context Map: index.html

## 1. Purpose
The physical entry point and structural skeleton of Image Boss. Defines the application shell, workspace layout, and initial asset loading (CSS/Fonts). Provides the DOM targets required by `main.js` for dynamic orchestration.

## 2. Imports
- **main.css**: Global design system and layout rules.
- **chat.css**: Specialized styles for the AI chat interface.
- **Google Fonts (Inter)**: Typography.
- **src/main.js (Type: Module)**: Bootstrap script that initializes the local logic.

## 3. Dependencies
- **Uses**:
  - `main.js`: Consistently manipulates this DOM to render results.
- **Used by**:
  - Client Browser: Primary file requested on visit.

## 4. State Management
(Empty - Static structural file)

## 5. Project Flow
1. **Load Stage**: Browser parses the HTML, requesting CSS and the JS Module.
2. **Bootstrap Stage**: `main.js` executes, hooks into DOM IDs (like `#nav`, `#workspace`), and begins injecting the service registry.
3. **Runtime Iteration**: As the user interacts, JS toggles visibility classes (`hidden`) and updates canvas contents (`#original-canvas`, `#result-canvas`) within the skeleton.

## 6. Code Structure

- **`<head>` (Block)**
  - **Name (Type)**: Head (Meta)
  - **Purpose**: Page metadata, SEO tags, and external asset pre-loading.

- **`#app` (Container)**
  - **Name (Type)**: App Shell (Div)
  - **Purpose**: Global wrapper for the entire SPA layout.

- **`#nav` (Navigation)**
  - **Name (Type)**: Navigation (Nav)
  - **Purpose**: Container for the sidebar brand and dynamically injected service links (`#nav-services`).

- **`#main` (Main Content Area)**
  - **Name (Type)**: Main (Main)
  - **Purpose**: The primary workspace area.
  - **Children**:
    - `#status-bar`: Global progress reporting.
    - `#upload-area`: Initial entry point for file ingestion.
    - `#workspace`: The side-by-side comparison and editing engine (initially `hidden`).

- **`#workspace` (Sub-Container)**
  - **Name (Type)**: Workspace (Div)
  - **Purpose**: The interaction engine for Image Boss.
  - **Key Elements**:
    - `#original-canvas`: Source image display.
    - `#result-canvas`: AI output display.
    - `#caption-result-container`: Special view for text-based AI results.
    - `#layer-picker`: Dynamic list for object extraction.
    - `#controls`: Inject target for service-specific sliders.

- **`#btn-process` (Action)**
  - **Name (Type)**: Process Button (Button)
  - **Purpose**: The primary trigger for initiating AI inference.

- **`<script type="module" src="/src/main.js"></script>`**
  - **Name (Type)**: Bootstrapper (Script)
  - **Purpose**: Injects the application's logic.

## 7. Points To Consider
- **Target Selection Stability**: Consider keeping DOM IDs (like `#result-canvas`) stable (L67) as the `main.js` orchestration bridge is highly dependent on these specific selectors.
- **Overlay Layering**: Note that the interactive SAM layer must sit above the canvas (L68); consider using z-index to manage the interaction vs. visual notification stacking.
- **State Feedback**: Consider using `.hidden` (L69) for visibility transitions to ensure predictable CSS performance and accessible state changes for screen readers.
