# Context Map: background-removal/worker.js


## 1. Purpose

The high-performance inference thread for all background removal models. It manages the lifecycle of the Transformers.js-based AI models (specificallyMODNet, InSPyReNet, and BiRefNet), handles the conversion of incoming pixel data into tensors, and transforms the raw AI probability maps into 1-channel masks ready for rendering.


## 2. Imports

- **Transformers.js**:
  - Syntax: `import { pipeline, env, RawImage } from "@huggingface/transformers";`
  - Purpose: Core AI framework for loading ONNX models and running WASM/WebGPU inference.


## 3. Dependencies

- **Used by**:
  - `processor.js` (The main-thread communicator).

- **External APIs**:
  - **WebGPU API**: Primary hardware acceleration target.
  - **OffscreenCanvas API**: Used for tensor-to-bitmap conversion inside the worker.
  - **navigator.hardwareConcurrency**: Used to optimize WASM thread counts.


## 4. State Management

- **segmenters (Variable/Object)**:
  - Syntax: `const segmenters = {};`
  - Purpose: A persistence cache that holds loaded model pipelines (pipelines take 500ms+ to initialize, so they must be cached).

- **workerMaskCanvas (Variable)**:
  - Syntax: `let workerMaskCanvas = null;`
  - Purpose: An `OffscreenCanvas` instance reused across processing cycles to minimize memory allocation.


### 1. Hardware Detection
- **Flow**: Probes the browser for WebGPU and `shader-f16` (fp16) support.

### 2. Model Load
- **Flow**: If the requested model isn't in `segmenters`, it initializes a Transformers.js pipeline with specific `device` and `dtype` targets.
- **Files Involved**:
  - `@huggingface/transformers`: Downloads and initializes the ONNX runtime session for the selected subject-extraction model.

### 3. Pre-processing
- **Flow**: Converts the incoming `ImageBitmap` to a `RawImage` tensor.

### 4. Inference
- **Flow**: Invokes the AI model, passing the image and model-specific constraints (like `size`).
- **Files Involved**:
  - `@huggingface/transformers`: Executes the high-CPU/GPU inference operation.

### 5. Post-processing
- **Flow**: Converts the AI output (Float32Array of probabilities) into a visual PNG-ready mask using `extractMaskBitmap`.

### 6. Transfer
- **Flow**: Transfers the resulting `ImageBitmap` back to the main thread via the `postMessage` transfer list.
- **Files Involved**:
  - `processor.js`: Receives the final subject mask for compositing and UI update.


## 6. Code Structure

- **extractMaskBitmap (Function)**:
  - Syntax: `async function extractMaskBitmap(output) { ... }`
  - Purpose: AI-to-Vis conversion engine.
  - Working: Normalizes the AI output (Probabilities 0.0-1.0) into Uint8 (0-255). It paints these values into the Alpha channel of a 32-bit pixel buffer (`val << 24`) and returns an `ImageBitmap`.

- **loadModel (Function)**:
  - Syntax: `async function loadModel(modelId, onProgress) { ... }`
  - Purpose: Pipeline lifecycle management.
  - Working: Maps human-readable service IDs to HuggingFace repository IDs. It dynamically selects between 'webgpu' and 'wasm' based on hardware capabilities and handles the download progress feedback.

- **onmessage (Handler)**:
  - Syntax: `self.onmessage = async ({ data }) => { ... };`
  - Purpose: Global message router.
  - Working: Orchestrates the `process` and `clear` commands. It includes detailed performance timing instrumentation and a specific numeric error mapper for common WebGPU driver failures.


## 7. Points To Consider

- **The "Graph Capture" Invariant**: For BiRefNet and complex models, `webgpu.graphCapture` is disabled to prevent common "Index 597685352" errors on Intel/Windows drivers.

- **Zero-Copy Scaling**: The worker performs input scaling to model dimensions using the high-performance `RawImage.fromCanvas` and the `size` option in the pipeline runner.

- **Alpha Channel Packing**: The mask is returned as a 32-bit bitmap where the RGB is white (255, 255, 255) and the Mask is in the Alpha channel. This allows the main thread to use a single `destination-in` operation to cut out the subject.

- **Memory Disposal**: The `clear` command allows the application to explicitly call `.dispose()` on pipelines, releasing multi-hundred-megabyte VRAM buffers back to the system.
