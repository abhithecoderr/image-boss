# Context Map: background-removal/worker.js

## 1. Purpose
High-performance background removal engine utilizing multiple AI models (InSPyReNet, MODNet, BiRefNet). Implements a Resolution-Independent Guided Matting architecture that combines low-res AI intelligence with high-res edge refinement for 1024px-grade results with low latency.

## 2. Imports
- **@huggingface/transformers**: Provides the ONNX execution environment and model serialization.
  - `pipeline`: High-level task-based execution.
  - `AutoModel`/`AutoProcessor`: Low-level surgical model control.
  - `RawImage`/`Tensor`: Data structures for AI input/output.

## 3. Dependencies
- **Uses**:
  - Hugging Face Hub (Model weights/configs).
  - Browser GPU (WebGPU) + WASM fallbacks.
- **Used by**:
  - [processor.js](file:///c:/projects/bg/my-ai-app/src/services/background-removal/processor.js) (IPC) - Manages image transfers and command routing.

## 4. State Management

- **segmenters (Variable/Object)**
  - **Syntax**: `const segmenters = {}`
  - **Purpose**: LRU-style cache for loaded AI models to prevent redundant downloads and compilation.

- **gpuConfig (Variable/Object)**
  - **Syntax**: `let gpuConfig = null`
  - **Purpose**: System hardware state (WebGPU/FP16 availability).

- **lastMask (Variable/Float32Array)**
  - **Syntax**: `let lastMask = null`
  - **Purpose**: The "Hot-Refinement" cache. Stores raw AI output probabilities (0-1) used for near-instant slider updates.

- **guidedPool (Variable/Object)**
  - **Syntax**: `let guidedPool = { size: 0, buffers: {} }`
  - **Purpose**: Memory-efficient buffer pool for Guided Filter operations to avoid massive allocation spikes.

## 5. Project Flow
1. **Intake**: Worker receives `ImageBitmap` + service options via IPC.
2. **Analysis Pass (Low-Res AI)**: The image is downscaled to a "stable" resolution (384-512px). The AI model generates a coarse probability mask.
3. **Guidance Pass (Refinement)**: The system applies the **Fast Guided Filter** theory. It uses the high-res original image as a grayscale "map" to refine the coarse AI mask, aligning edges with physical object boundaries.
4. **Synthesis**: The refined mask is stored in the `lastMask` cache and binary-thresholded according to user settings.
5. **Post-Processing**: (Optional) 1D Box Blur is applied for soft-feathering.
6. **Export**: The 1-channel mask buffer is transferred back to the main thread via transferables for GPU composition in `processor.js`.

## 6. Code Structure

- **Imports & Env (Block)**
  - **Name (Type)**: Environment Setup (Declaration)
  - **Syntax**: `import { ... } from "@huggingface/transformers"; env.useBrowserCache = true;`
  - **Purpose**: Initializes the Transformers.js runtime.

- **GPU Diagnostics (Block)**
  - **Name (Type)**: getGPUConfig (Function)
  - **Syntax**: `async function getGPUConfig()`
  - **Purpose**: Detects WebGPU and Shader-FP16 support.

- **`applyFeathering` (Function)**
  - **Name (Type)**: applyFeathering (Visual Filter)
  - **Syntax**: `function applyFeathering(data, width, height, radius)`
  - **Working**: Implements a high-speed 1D Box Blur (Horizontal then Vertical pass). Avoids the $O(R^2)$ complexity of a 2D kernel.

- **`guidedFilter` (Function)**
  - **Name (Type)**: guidedFilter (Refinement Core)
  - **Syntax**: `function guidedFilter(p, I, width, height, r, eps)`
  - **Purpose**: Edge-aware mask refinement.
  - **Working**: Implements **Fast Guided Filter Theory**. Calculates local linear coefficients between the guidance image (I) and input mask (p). This "snaps" a fuzzy AI mask to high-resolution image edges.

- **`resizeMaskBilinear` (Function)**
  - **Name (Type)**: resizeMaskBilinear (Utility)
  - **Syntax**: `function resizeMaskBilinear(src, srcW, srcH, dstW, dstH, dst)`
  - **Working**: Standard bilinear interpolation for mask scaling during the AI-to-Guidance transition.

- **`loadModel` (Function)**
  - **Name (Type)**: loadModel (Lifecycle)
  - **Syntax**: `async function loadModel(modelId, onProgress)`
  - **Working**: Dynamic model loader. Orchestrates model mapping (`configs`), hardware EP selection (WebGPU/WASM), and progress tracking.

- **`process` Logic (Branch in onmessage)**
  - **Name (Type)**: Image Processing (Handler)
  - **Working**: Implements **InSPyReNet Guided Matting**. Steps: (1) Low-res AI pass. (2) Grayscale guidance preparation. (3) Guided Filter refinement. (4) Caching to `lastMask`.

- **`refine` Logic (Branch in onmessage)**
  - **Name (Type)**: Hot-Refinement (Handler)
  - **Syntax**: `if (type === "refine") { ... }`
  - **Working**: Bypasses the GPU/AI entirely. Uses the cached `lastMask` to re-apply thresholding and feathering in sub-10ms timeframes.

## 7. Points To Consider
- **Hot-Refinement Cache**: Consider keeping `lastMask` as raw float32 probabilities because it allows for reversible adjustments (L31) without losing the original AI prediction data.
- **BiRefNet Swin Compatibility**: Note that the Swin architecture in BiRefNet currently requires a WASM fallback (L89) because of WebGPU kernel compatibility; monitor for future driver updates.
- **Zero-Copy Optimization**: Consider always using the `postMessage` transfer list for result buffers because it prevents UI thread freezes on high-resolution images.
- **Memory Pressure**: While `guidedPool` reduces GC pressure, consider calling `clear()` periodically if working with many high-res images to stay within browser memory limits.
