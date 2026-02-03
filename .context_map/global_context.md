# Global Context - Image Boss

## Project Introduction
**Image Boss** is a high-performance, browser-native AI image processing suite. It provides a specialized set of tools including background removal, smart upscaling, face blurring, and object segmentation, all executing locally within the user's browser environment.

## Project Philosophy and Need
The project is built on the philosophy of **"Edge Intelligence"**. By running AI models directly on the client side, Image Boss eliminates server-side processing costs, ensures $100\%$ user data privacy (no images ever leave the device), and provides a low-latency experience by utilizing the user's local GPU. It serves as a private, cost-free alternative to cloud-based image editing APIs.

## Tech Stack
- **Runtime**: Vanilla JavaScript (ES6 Modules)
- **AI Engines**:
  - `Transformers.js` (Hugging Face) for Transformer-based models (SAM, ViT, BirefNet).
  - `ONNX Runtime Web` (ORT) for specialized models (Real-ESRGAN, InSPyReNet) and surgical control over YOLO-Pose tensors.
- **Acceleration**: `WebGPU` (Primary) with `WASM/CPU` Fallbacks.
- **IO/Processing**: Native HTML5 `Canvas API`, `Web Workers`, and `OffscreenCanvas`.
- **Third-Party Libraries**: `browser-image-compression` for smart resizing.

## Folder Structure
```text
/ (Project Root)
├── .context_map/           # HCM Protocol Documentation
│   ├── context/            # Shadow Files (Context Maps)
│   ├── decision_logs.md    # Architecture & Design Decisions
│   └── global_context.md   # Project Master Index
├── public/                 # Static Assets
│   ├── main.css            # Global Design System
│   └── chat.css            # Chat-Specific Styling
├── scripts/                # Optimization & Conversion Scripts
│   ├── convert.py
│   ├── convert_inspyrenet_onnx.py
│   ├── optimize_birefnet_webgpu.py
│   ├── patch_inspyrenet_webgpu.py
│   ├── quantize_inspyrenet.py
│   └── validate_model.py
├── src/
│   ├── main.js             # Global App Orchestrator
│   ├── config.js           # Services & Model Registry
│   ├── core/               # Shared Utilities
│   │   ├── canvas-utils.js # Image Manipulation
│   │   └── ui-utils.js     # DOM & Feedback Helpers
│   └── services/           # Feature-Specific Processors
│       ├── background-removal/ (processor.js, worker.js)
│       ├── blur/               (processor.js, worker.js)
│       ├── captioning/         (processor.js, worker.js)
│       ├── chat/               (processor.js, worker.js)
│       ├── compression/        (processor.js)
│       ├── file-conversion/    (processor.js)
│       ├── line-art/           (processor.js)
│       ├── object-segmentation/(processor.js, worker.js)
│       ├── style-transfer/     (processor.js - Stub)
│       └── upscaling/          (processor.js, worker.js)
├── index.html              # UI Skeleton & Entry Point
├── package.json            # Node Dependencies & Metadata
└── .gitignore              # Dependency & Build Exclusions
```

## How each file connects with each other
The application follows a **Hub-and-Spoke** architecture centered on `main.js`.
1. **Coordination**: `main.js` imports `config.js` to build the UI and route user actions.
2. **Utility Access**: Both `main.js` and all service processors depend on `core/canvas-utils.js` for image manipulation and `core/ui-utils.js` for feedback.
3. **Task Delegation**: When a service is activated, `main.js` calls the corresponding `processor.js`, which manages a dedicated `Web Worker` for non-blocking AI inference. For Blur/Pose services, the worker utilizes raw ONNX sessions to bypass high-level pipeline registries.
4. **Data Loop**: Raw data (1-channel masks or ImageBitmaps) is transferred to workers via IPC. Processes utilize **GPU-Accelerated Scaling** (scaling low-res model outputs via `ctx.drawImage`), **Hot-Refinement** (caching AI results in workers), and **Lazy Candidate Rendering** (deferring full-res rendering until selection) to maintain 60fps UI performance even with multi-million pixel images.

## Each folder and file 2-3 line purpose description

### Core Root
- **[index.html](file:///c:/projects/bg/my-ai-app/index.html)**: The semantic skeleton of the app, defining the side-by-side workspace and navigation containers. [Context Map](file:///c:/projects/bg/my-ai-app/.context_map/context/index.md)
- **[src/main.js](file:///c:/projects/bg/my-ai-app/src/main.js)**: The central orchestrator handling DOM events, service switching, and the global processing lifecycle.
- **[src/config.js](file:///c:/projects/bg/my-ai-app/src/config.js)**: The manifest file defining AI model paths, hardware requirements, and UI configuration constants. [Context Map](file:///c:/projects/bg/my-ai-app/.context_map/context/src/config.md)
- **public/**: Host for shared static assets, including global CSS stylesheets ([main.css](file:///c:/projects/bg/my-ai-app/.context_map/context/public/main.md), [chat.css](file:///c:/projects/bg/my-ai-app/.context_map/context/public/chat.md)) and branding assets.
- **scripts/**: A collection of Python-based automation tools for ONNX model conversion ([convert.py](file:///c:/projects/bg/my-ai-app/.context_map/context/scripts/convert.md)), weight optimization ([optimize_birefnet_webgpu.py](file:///c:/projects/bg/my-ai-app/.context_map/context/scripts/optimize_birefnet_webgpu.md)), and validation ([validate_model.py](file:///c:/projects/bg/my-ai-app/.context_map/context/scripts/validate_model.md)).

### Core Utilities (`src/core/`)
- **[canvas-utils.js](file:///c:/projects/bg/my-ai-app/src/core/canvas-utils.js)**: A low-level toolkit for pixel manipulation, filters (Sobel/Blur), and canvas export logic.
- **[ui-utils.js](file:///c:/projects/bg/my-ai-app/src/core/ui-utils.js)**: Reusable helpers for toast notifications, progress bars, and declarative DOM element creation.

### Service Modules (`src/services/`)
- **[background-removal/](file:///c:/projects/bg/my-ai-app/src/services/background-removal/)**: Implements BiRefNet and MODNet. Uses **Raw 1-Channel Masking** and GPU-backed composition to enable near-instant threshold and feathering updates.
- **[upscaling/](file:///c:/projects/bg/my-ai-app/src/services/upscaling/)**: A tile-based implementation of Real-ESRGAN for 4x resolution enhancement. Employs a **Hot-Refinement** cache to allow real-time adjustment of brightness, saturation, and detail intensity (<100ms) without re-running the heavy AI tiling loop.
- **[blur/](file:///c:/projects/bg/my-ai-app/src/services/blur/)**: Uses YOLO-Pose (via raw ORT for tensor-level control) to detect faces and apply localized, feathered Gaussian blurs.
- **[object-segmentation/](file:///c:/projects/bg/my-ai-app/src/services/object-segmentation/)**: Interactive SlimSAM and SAM-2 processors. Pioneer of the **Hot-Refinement** and **Low-Res Masking + GPU Scaling** patterns used throughout the app.
- **[chat/](file:///c:/projects/bg/my-ai-app/src/services/chat/)**: Integrates local LLMs (LFM 1.2B) for conversational AI within the workspace.

## State Management
The project uses a **Reactive DOM-centric State** approach rather than a central store like Redux:
- **UI State**: Managed via CSS classes (`.active`, `.hidden`) and `HTMLElement.dataset` attributes on canvases for metadata.
- **Worker Registry**: Each `processor.js` maintains a singleton reference to its worker to prevent redundant spawns.
- **Callback Registry**: Async IPC responses are handled via a static callback map in `main.js` or specialized registries in files like `chat/processor.js`.

## Project User Flow
1. **Intake**: User drops an image into the `#drop-zone` (`main.js` + `canvas-utils.js`).
2. **Setup**: The original image is rendered to the source canvas and the service toolbar is populated from `config.js`.
3. **Inference**: User triggers a tool; `main.js` invokes a `processor.js` which signals its `worker.js`.
4. **Feedback**: Granular progress percentages from the worker are channeled back through `ui-utils.js` to the status bar.
5. **Realisation**: The worker returns result buffers; the processor reconstructs the final result canvas for the UI.

## Constraints and To Remember Points
- **Memory Management**: Always use `Transferables` (ImageBitmaps/ArrayBuffers) during `postMessage` to avoid OOM crashes on large images.
- **GPU Compatibility**: Check for `navigator.gpu` presence; models must have WASM fallbacks configured in `config.js`.
- **Canvas Limitations**: Browsers have strict max dimensions (approx 16k px); service processors like background-removal auto-downscale to 2048px for stability. **Interactive tools** (e.g. Object Segmentation) MUST cap internal AI resolution at 768px to ensure real-time responsiveness and avoid WebGPU command-buffer flooding.
- **Garbage Collection**: Explicitly call `URL.revokeObjectURL` and `bitmap.close()` immediately after use to prevent memory leaks during long sessions.
