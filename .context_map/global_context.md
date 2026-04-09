# Global Context - Image Boss (Digital DNA)

## 1. Introduction

**Image Boss** is a browser-native AI image processing suite built with React 19 and Vite. All AI inference runs locally on the user's device via WebGPU-accelerated Web Workers — no server uploads, no cloud dependency. The app provides background removal, super-resolution upscaling, object segmentation, AI captioning, style transfer, and image compression through a unified single-page interface.


## 2. Tech Stack & Dependencies

- **Framework**: React 19 (Vite 6.0) — `react v19.0.0`, `react-dom v19.0.0`

- **Styling**: Vanilla CSS with Modern CSS Variables

- **AI Engines**:
  - `@huggingface/transformers v3.8.1` — Vision and LLM tasks (SAM, Florence-2, LFM)
  - `onnxruntime-web v1.20.1` — Direct ONNX graph execution for YOLO-Pose, Real-ESRGAN
  - `@mediapipe/tasks-vision v0.10.21` — Specialized vision tasks
  - `upscaler v1.0.0-beta.19` — Super-resolution pipeline orchestration

- **Acceleration**: WebGPU (primary), multi-threaded WASM/CPU fallback

- **Data Engineering**: Web Workers, `ImageBitmap` zero-copy transfers, `OffscreenCanvas`

- **Utilities**: `browser-image-compression v2.0.2` — Client-side file size optimization


## 3. Folder Structure

```text
/ (Project Root)
│
├── .context_map/              # HCM Protocol Documentation (7-header standard)
│   ├── context/               # Shadow Files (Digital Twins)
│   ├── decision_logs.md       # Distilled Architecture Decisions
│   ├── realisations.md        # Distilled Multi-Session Wisdom
│   └── global_context.md      # Project Master Index (Digital DNA)
│
├── public/                    # Static Assets (Models, Weights, Icons)
│
├── src/                       # Primary logic directory
│   ├── App.jsx                # Main Entry Point & Layout Orchestrator
│   ├── main.jsx               # React Bootstrap & Context Provider wrapping
│   ├── config.js              # Services & Model Registry (Application Manifest)
│   │
│   ├── components/            # Presentation Layer
│   │   ├── Sidebar.jsx        # Navigation & Service Selection
│   │   ├── ControlPanel.jsx   # Dynamic service parameter controls
│   │   ├── Workspace.jsx      # Visual stage, zoom, & feature overlays
│   │   └── features/          # Specialized interactive UI (SAM, MaskEditor, Comparison)
│   │
│   ├── context/               # Global State Synchronization
│   │   └── AppContext.jsx     # Central State Hub (Redux-lite pattern)
│   │
│   ├── core/                  # Shared Utilities (Vanilla JS)
│   │   ├── canvas-utils.js    # High-performance pixel manipulation
│   │   └── ui-utils.js        # DOM assistance & Toast Notification helpers
│   │
│   ├── hooks/                 # Business Logic & Connector Hooks
│   │   ├── useProcessor.js    # AI execution lifecycle & worker management
│   │   ├── useSAM.js          # Segment Anything interaction logic
│   │   ├── useMaskEditor.js   # Manual refining & brush logic
│   │   └── useFileIngestion.js # File processing intake & validation
│   │
│   └── services/              # Feature-Specific AI Implementation Tier
│       ├── background-removal/ # MODNet & BiRefNet extractions
│       └── (others...)        # Tiling upscalers, YOLO blur, Chat, etc.
│
├── index.html                 # HTML5 Skeleton
└── package.json               # Node Manifest
```


## 4. Project User Flow

### 1. Intake

- **Flow**: User drops an image into the `Workspace`. The file is captured by `useFileIngestion`, validated for dimensions, converted to an internal `HTMLCanvasElement` using `canvas-utils.js`, and committed to the global state.

- **Files Involved**:
  - `useFileIngestion.js`: Observes drag-and-drop events and manages the `FileReader` lifecycle.
  - `canvas-utils.js`: Provides `loadImage` and `imageToCanvas` to generate the initial pixel buffer.

### 2. Configuration & Strategy

- **Flow**: User navigates the `Sidebar` to select a tool. The `AppContext` updates `currentService`, which triggers `ControlPanel.jsx` to render the relevant sliders and toggles (e.g., "Blur Radius" or "Quantization").

- **Files Involved**:
  - `Sidebar.jsx`: Emits `selectService` calls to the context.
  - `ControlPanel.jsx`: Dynamically maps `currentService.options` to UI controllers.

### 3. Inference Execution

- **Flow**: User clicks "Process". The UI triggers the `process` function in `useProcessor.js`. This hook selects the correct AI processor (e.g., `background-removal/processor.js`), initializes a singleton Web Worker, and transfers the `ImageBitmap` for processing.

- **Files Involved**:
  - `useProcessor.js`: Manages the loading state and serves as the bridge between React and Worker.
  - `service/processor.js`: Houses the business logic for preparing data for the model.

### 4. Evaluation & Refinement

- **Flow**: The Web Worker performs tiled inference or global extraction and sends the result buffer back. The processor performs final compositing (like white-filling for JPEGs) and updates `resCanvasState`.

- **Files Involved**:
  - `service/worker.js`: Executes high-CPU/GPU models (SAM, Real-ESRGAN) on a separate thread.
  - `Workspace.jsx`: Automatically mirrors the new static result canvas to the DOM-visible ref.


## 5. State Management

The application utilizes the React Context API as its "Digital Nervous System":

- **srcCanvasState / originalCanvas**
  - Syntax: `const [originalCanvas, setOriginalCanvas] = useState(null);`
  - Purpose: Stores the persistent master reference of the user's uploaded image.
  - File Location: `AppContext.jsx`

- **resCanvasState / resultCanvas**
  - Syntax: `const [resultCanvas, setResultCanvas] = useState(null);`
  - Purpose: Stores the result of the most recent AI processing pass.
  - File Location: `AppContext.jsx`

- **currentService**
  - Syntax: `const [currentService, setCurrentService] = useState(SERVICES[...]);`
  - Purpose: Tracks which AI tool is currently active in the UI.
  - File Location: `AppContext.jsx`

- **isProcessing**
  - Syntax: `const [isProcessing, setIsProcessing] = useState(false);`
  - Purpose: Toggles global UI blocking and loading spinners.
  - File Location: `AppContext.jsx`

- **serviceResults**
  - Syntax: `const [serviceResults, setServiceResults] = useState({});`
  - Purpose: A persistence map allowing users to toggle between "Upscale" and "Blur" without re-running long inferences.
  - File Location: `AppContext.jsx`


## 6. How each file connects with each other

The application maintains a **Strict Hierarchical Registry** to ensure that logic never leaks into presentation:

- **Context-as-Glue**: `AppContext.jsx` is the heart. It doesn't perform logic; it merely stores the results of logic performed by hooks. `App.jsx` wraps the entire tree to provide this shared memory.

- **The Hook Bridge**: Components like `Workspace.jsx` and `ControlPanel.jsx` never talk to the AI Workers directly. They instead talk to `useProcessor.js` or `useSAM.js`. These hooks act as "Middle Managers" that handle the messy details of `postMessage`, `ImageBitmap` transfers, and algorithmic derivations (like converting a brush stroke to a SAM bounding box).

- **Deterministic Services**: The files in `src/services/` are designed to be "Vanilla-Compatible." They do not import React; they instead accept canvases and numbers as arguments and return results. This allows the AI engine to be tested or even migrated to a different framework without touching the core ML logic.

- **Shared Core**: All logic paths eventually converge at `src/core/canvas-utils.js`. Whether it's an AI worker preparing an input or the `useFileIngestion` hook reading a file, they all use the same centralized pixel-manipulation functions to ensure cross-service consistency.


## 7. Points to Consider

- **The "Digital DNA" Sync**: Documentation in `.context_map` must match the code 1:1. Bypassing shadow map updates leads to unrecoverable "Context Drift".

- **Coordinate Normalization**: Always communicate UI coordinates as percentages (0..1) to the AI workers. This ensures that SAM points work correctly whether the source is 500px or 5000px.

- **Transferable Performance**: Moving `ImageBitmap` via the transferables array is the only way to avoid "Main-Thread Jank" during 4K image operations.

- **Model Quantization**: To run locally without crashes, use 4-bit (q4) or fp16 weights where possible. 32-bit (fp32) should be reserved for high-precision tasks like YOLO face-pose detection.

- **Memory Sanitation**: Browser GC is too slow for AI. Explicitly call `bitmap.close()` and `URL.revokeObjectURL` immediately after use.
