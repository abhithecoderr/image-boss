# Context Map: main.js

## Purpose
Main application controller for Image Boss - orchestrates the entire user interface, service navigation, image processing workflows, and feature coordination. Acts as the central hub connecting user interactions with service processors, managing the complete lifecycle from file upload through processing to download.

## Imports
- **config.js**: `SERVICES`, `SERVICE_ORDER` - Service definitions and navigation order
- **core/canvas-utils.js**: `loadImage`, `imageToCanvas`, `downloadCanvas`, `canvasToBlob` - Image manipulation utilities
- **core/ui-utils.js**: `showToast`, `updateProgress` - User feedback functions
- **Dynamic imports**: Service processors loaded on-demand via `./services/${serviceId}/processor.js`

## Dependencies
- **Used by**: Entry point - no files import this (initialized on page load)
- **Uses**: All service processor modules (background-removal, compression, file-conversion, upscaling, blur, chat)
- **DOM elements**: Manages all UI elements via `elements` object
- **Connects**: Coordinates between config, canvas utils, UI utils, and dynamically loaded service processors

## Project Flow Connection
- **Entry point**: Initializes on page load via `init()`
- **Service coordinator**: Loads appropriate processor modules based on user service selection
- **UI orchestrator**: Manages workspace visibility, control panels, canvas displays, and user interactions
- **Processing pipeline**: Original image → Service processor → Result canvas → Download
- **State manager**: Maintains application state across service switches and processing operations

## State Management

**`state` object** - Centralized application state tracking all runtime data
- `currentService`: Active service configuration from SERVICES
- `originalImage`/`originalCanvas`: Source image references (HTMLImageElement and Canvas)
- `resultCanvas`: Processed output canvas
- `processor`: Currently loaded service module instance
- `isProcessing`: Boolean flag preventing concurrent operations
- `editing`: Manual refinement state object
  - `activeTool`: Current tool ('none', 'erase', 'restore')
  - `brushSize`: Pixel size for manual editing
  - `isDrawing`: Mouse down tracking
  - `manualMaskCanvas`/`manualMaskCtx`: Editable mask layer
  - `lastSavedMask`: Snapshot for undo operations
- `originalFile`: File metadata (name, type)
- `comparison`: Upscaling slider state (active flag, position percentage)
- `samPoints`: Array of `{x, y, label}` refinement coordinates
- `samPointLabel`: Active tool mode for SAM (1=Positive/Green, 0=Negative/Red)

**`elements` object** - DOM element references for all interactive components
- Navigation and upload containers
- Canvas elements (original, result, placeholder)
- Control panels, buttons, and action elements
- Overlay elements (SAM selection, layer picker)

## File Code Structure

**Imports** (L6-8)

**`debounce(func, timeout)`** (L10-16) - Timer-based function delay wrapper

**`state` object** (L19-42) - Application state (service, canvases, processor, editing, layers, comparison)

**`elements` object** (L45-63) - DOM element references

**`init()`** (L73-101) - Renders nav, creates overlays, sets up listeners, and initializes the **Caption Copy Button** (L78-98) with visual "Copied!" feedback and clipboard integration.

**`createSAMOverlay()`** (L85-141) - Generates the interactive layer for point selection. Features **Refinement Throttling** (L104-124) via `throttledSmartSelect` to prevent GPU command-buffer flooding during interactive use.

**`createRefineOverlay()`** (L100-124) - Creates floating action bar with Generate/Cancel buttons

**`renderNavigation()`** (L129-146) - Builds service navigation buttons from config

**`setupComparisonSlider()`** (L152-320) - Creates before/after slider for upscaling with clip-path

**`selectService(serviceId)`** (L421-475) - Switches active service, renders controls, and releases memory. Features **Visibility Sync** (L467-471) to ensure the caption container and result canvas are correctly toggled based on the service type.

**`renderControls(serviceId)`** (L442-874) - Generates service-specific control panels. Uses isolated scope `{}` for cases to prevent `SyntaxError` (L780-820). **Blur Case** includes after-sliders; **Object Case** includes mode toggles and manual tools.

**`setupEventListeners()`** (L876-916) - Binds upload, drag/drop, button, and canvas edit events.

**`handleFileSelect(e)`** (L918-924) - File input change handler.

**`handleFile(file)`** (L926-985) - Validates, loads image, initializes workspace.

**`resetWorkspace()`** (L987-1012) - Clears all state and returns to upload screen.

**`processImage()`** (L1085-1151) - Lazy-loads processor, calls process(), and routes results. Includes **Caption Routing** (L1127-1130) which populates UI labels with raw strings and stores the padded canvas for exports.

**`smartSelect()`** (L1087-1137) - Handles interactive segmentation. Implements **Coordinate Scaling** (L1093-1100) to map points to the 1024px AI input dimension.

**`handleObjectResults(result)`** (L1138-1196) - Renders the 3-variation picker for SAM outputs.

**`loadProcessor(serviceId)`** (L1231-1237) - Dynamic import wrapper.

**`getControlValues()`** (L1239-1287) - Extracts control values per service.

**`downloadResult()`** (L1383-1463) - Exports result with **Service-Specific Suffixes**.

**`init()` call** (L1374) - Application start.

**Chat UI functions** (L1378-1411) - `setupChatUI()`, `removeChatUI()`, `handleChatSend()`.

**`updateResultDisplay()`** (L1529-1606): Synchronizes UI with result. Features **View Toggle** (L1542).

## Code Details

**debounce** (L10-16): Closure with `timer` variable, `clearTimeout` + `setTimeout`, function.apply for context

**state object** (L19-42): Object literal with nested objects (editing, originalFile, comparison), arrays (resultLayers), null/default primitives

**elements object** (L45-63): getElementById results, null placeholders for dynamic elements

**init** (L68-78): Sequential function calls, array index access for default service

**createSAMOverlay** (L80-100): Guard with early return, createElement chain, appendChild, reference storage

**createRefineOverlay** (L102-132): Template string innerHTML, querySelector + onclick binding, stopPropagation

**renderNavigation** (L134-154): forEach loop, template literals, conditional class concatenation, addEventListener with arrow function

**setupComparisonSlider** (L156-354): Guard clauses, createElement chain, inline style.cssText, canvas drawImage calls, clip-path manipulation, closure for updateSlider, event listeners (mouse + touch), getBoundingClientRect, Math.max/min clamping

**selectService** (L356-394): querySelectorAll + forEach, classList.toggle, optional chaining for processor.clear/dispose

**renderControls** (L396-698): Switch statement (7 cases), template literal HTML, includes() check for `updateBlurDebounced` (L685-688).

**setupEventListeners** (L700-740): Multiple addEventListener, preventDefault for drag, dataTransfer.files, file.type.startsWith

**handleFile** (L750-807): Size validation with early return, try-catch block, await expressions, destructuring, getContext('2d'), classList operations, optional chaining

**resetWorkspace** (L809-834): Null assignments, array literals, innerHTML empty string, conditional service check

**processImage** (L836-900): Guard clause, boolean flags, try-catch-finally, conditional processor loading, await with progress callbacks, service-specific result handling

**loadProcessor** (L909-915): Dynamic import with template literal, logical OR for default export

**getControlValues** (L925-975): Empty object init, switch statement, optional chaining + OR defaults, parseFloat/parseInt

**downloadResult** (L971-1053): Uses `suffixMap` (L992-1003) to generate accurate filenames. Implements binary search (L1021-1035) for targetMB quality optimization.

**Manual editing** (L1097-1194): Canvas createElement, getContext('2d'), globalCompositeOperation switching, beginPath/arc/fill, coordinate scaling with getBoundingClientRect, classList operations
