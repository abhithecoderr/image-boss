# Context Map: blur/worker.js

## 1. Purpose
Background execution of YOLO26-pose for privacy-focused face blurring. Implements manual tensor parsing for surgical keypoint access, adaptive geometry calculation for blur radii, and localized patch-based image processing using `OffscreenCanvas`.

## 2. Imports
- **onnxruntime-web/webgpu**: The core engine for WebGPU-accelerated tensor inference.
- **OffscreenCanvas (Native)**: Used for high-speed, non-DOM pixel manipulation and mask composition.

## 3. Dependencies
- **Uses**:
  - Hugging Face Hub (Model Weights).
- **Used by**:
  - [processor.js](file:///c:/projects/bg/my-ai-app/src/services/blur/processor.js) (via IPC) - Routes user requests to the worker.

## 4. State Management
- **session (Variable/Object)**
  - **Syntax**: `let session = null`
  - **Purpose**: Global singleton for the active ONNX Runtime session to avoid redundant model compilation and GPU memory spikes.
- **currentVariant (Variable/String)**
  - **Syntax**: `let currentVariant = 'nano'`
  - **Purpose**: Tracks the loaded model variant (nano, small, etc.) to gate lazy-swapping of models.
- **currentDevice (Variable/String)**
  - **Syntax**: `let currentDevice = 'wasm'`
  - **Purpose**: Tracks hardware acceleration status ('webgpu' vs 'wasm') for UI status reporting.
- **isInitializing (Variable/Boolean)**
  - **Syntax**: `let isInitializing = false`
  - **Purpose**: A mutex flag that prevents multiple heavy model-download/compilation threads from running simultaneously.

## 5. Project Flow
1. **Intake**: Worker waits for message events containing commands (`init`, `detect`, `blur`, `reblur`) and image data/parameters.
2. **Setup**: The input image is resized and normalized into an RGB Float32 tensor for the AI.
3. **Inference**: The YOLO26-pose model is executed on the local hardware (GPU/CPU).
4. **Resolution**: The raw output tensor is parsed into structured objects containing bounding boxes and 17-point keymaps.
5. **Synthesis**:
   - The system calculates precise blur radii based on Inter-Ocular Distance (IOD).
   - Localized patches are extracted and processed with Gaussian blurs and radial elliptical masks.
6. **Export**: The modified image data is transferred back to the main thread via Zero-Copy IPC messages.

## 6. Code Structure

- **Imports (Block)**
  - **Name (Type)**: Imports (Declaration)
  - **Syntax**: `import * as ort from 'onnxruntime-web/webgpu';`
  - **Purpose**: Bootstrap the AI execution environment.
  - **Working**: Configures WASM paths and loads the library singleton.

- **`MODEL_VARIANTS` (Object)**
  - **Name (Type)**: MODEL_VARIANTS (Registry)
  - **Syntax**: `const MODEL_VARIANTS = { ... }`
  - **Purpose**: Centralized registry for model repository paths.
  - **Working**: Maps user-facing keys ('nano', 'xlarge') to Hugging Face Hub IDs used by the fetch logic.

- **Detection Settings (Constants)**
  - **Name (Type)**: Settings (Constants)
  - **Syntax**: `const CONFIDENCE_THRESHOLD = 0.4;`
  - **Purpose**: Defines the physics and sensitivity of the face detector.

- **Global State (Declarations)**
  - **Name (Type)**: State (Variables)
  - **Syntax**: `let session = null; let currentVariant = 'nano'; ...`
  - **Purpose**: Runtime persistence across multiple worker calls.

- **`fetchWithProgress` (Function)**
  - **Name (Type)**: fetchWithProgress (Utility)
  - **Syntax**: `async function fetchWithProgress(url, label, onProgress, startWeight, endWeight)`
  - **Purpose**: Progress-aware binary downloader.
  - **Working**: Uses the native `fetch` body reader to calculate download percentages in real-time, providing feedback to the main thread during heavy model downloads.

- **`initDetector` (Function)**
  - **Name (Type)**: initDetector (Lifecycle)
  - **Syntax**: `async function initDetector(variant = 'nano', onProgress)`
  - **Purpose**: Hardware and Weights initialization.
  - **Working**: Implements a sequential fetch → compile → execute pipeline. It attempts to prioritize `webgpu` for speed, falling back to `wasm` if hardware acceleration is unavailable.

- **`detectFaces` (Function)**
  - **Name (Type)**: detectFaces (Analytical Core)
  - **Syntax**: `async function detectFaces(imageData, width, height)`
  - **Purpose**: Raw tensor parsing to extract human landmark coordinates.
  - **Working**: Implements **Stretched Preprocessing theory**. It forces a 640x640 stretch to match the model's training grid. By normalizing the result to 0-1, we "un-stretch" the detections back to the original aspect ratio without need for padding logic ($dx/dy$). Also incorporates an **Auto-Domain Check** that scans the first few detections/scores to distinguish between Pixel (0-640) and Normalized (0-1) coordinates.

- **NMS Helpers (Functions)**
  - **Name (Type)**: nms (Utility)
  - **Syntax**: `function nms(candidates, iouThreshold)`
  - **Purpose**: Removal of overlapping duplicate detections via Intersection over Union (IoU) calculation.

- **`applyBlur` (Function)**
  - **Name (Type)**: applyBlur (Visual Core)
  - **Syntax**: `async function applyBlur(imageData, width, height, detections, options = {})`
  - **Purpose**: Generates the final visual anonymization result.
  - **Working**: Implements **Surgical Geometry theory**. Using keypoints 1 (LE) and 2 (RE), it calculates the **Inter-Ocular Distance (IOD)**. This distance is used as a scale proxy ($IOD \times 2.2$) to generate a radius that fits the head precisely. It then extracts localized `OffscreenCanvas` patches to apply Gaussian blurs, which are finally clipped with radial-feathered elliptical masks to prevent harsh edges.

- **`dispose` (Cleanup)**
  - **Name (Type)**: dispose (Destructor)
  - **Syntax**: `function dispose()`
  - **Purpose**: Frees up the ONNX session memory.

- **`onmessage` (Handler)**
  - **Name (Type)**: onmessage (IPC Router)
  - **Syntax**: `self.onmessage = async (event) => { ... }`
  - **Purpose**: The primary async router for worker communication.
  - **Working**: Decodes `type` and `payload`. Notably handles the `reblur` command, which allows the UI to update radius/feathering sliders using cached detections without re-running the heavy AI inference pass.

## 7. Points To Consider
- **Coordinate Domain Check**: Consider utilizing the exhaustive signal check in `detectFaces` (L80) because YOLO26 models can switch between normalized and pixel coordinates depending on the export version.
- **Memory Pressure**: Note that `OffscreenCanvas` objects and local patches should be scoped correctly; consider explicit `bitmap.close()` calls (L106) to prevent leaks in long sessions.
- **Concurrency Mutex**: Consider the `isInitializing` flag (L107) as a critical defense against hardware driver crashes during rapid model variant swaps.
- **Scale Fallback**: Consider using the bounding-box width as a proxy if facial landmarks fail detection (L108) to ensure the blur still covers the subject.
