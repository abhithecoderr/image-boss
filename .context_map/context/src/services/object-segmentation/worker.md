# Context Map: object-segmentation/worker.js


## 1. Purpose

The persistent background thread for Segment Anything (SAM-1 and SAM-2). It implements a high-performance "Embeddings Cache" system, manages the lifecycle of the large SAM Encoder and lightweight SAM Decoder, and performs the 3-scale mask generation required for interactive object selection.


## 2. Imports

- **Transformers.js**:
  - Syntax: `import { SamModel, Sam2Model, AutoProcessor, RawImage, env } from '@huggingface/transformers';`
  - Purpose: Core AI framework for SAM and SAM-2 local execution.


## 3. Dependencies

- **Used by**:
  - `processor.js` (The main-thread interface).

- **External APIs**:
  - **WebGPU**: Primary hardware target.
  - **createImageBitmap**: Zero-copy transfer of resulting masks back to the UI.


## 4. State Management

- **cachedEmbeddings (Variable)**:
  - Syntax: `let cachedEmbeddings = null;`
  - Purpose: Stores the 256-channel feature map of the active image. This is the "Secret Sauce" that allows instant refinement.

- **cachedRawImage (Variable)**:
  - Syntax: `let cachedRawImage = null;`
  - Purpose: Persists the image tensor locally to avoid re-tokenization during refinement clicks.


### 1. Inertia Phase
- **Flow**: If `payload.bitmap` is provided, the worker assumes a "New Image" context and clears all old heavy assets.

### 2. Encoding (Heavy)
- **Flow**: Runs the SAM Encoder to produce a global feature map (`cachedEmbeddings`). This phase takes 500ms-2s.
- **Files Involved**:
  - `@huggingface/transformers`: Orchestrates the heavy Vision Transformer (ViT) encoding pass.

### 3. Coord Mapping
- **Flow**: Translates user percentage coordinates (0..1) into the model's pixel domain (1024px or similar).

### 4. Decoding (Light)
- **Flow**: Passes the `points`, `labels`, `boxes` (if any), and `cachedEmbeddings` to the Decoder. This phase takes <50ms. Bounding boxes are derived from UI brush strokes and provide the single most effective prompt for SAM accuracy.
- **Files Involved**:
  - `@huggingface/transformers`: Executes the lightweight prompt-decoder logic.

### 5. Multi-Scale Capture
- **Flow**: Extracts three masks (small, medium, large sub-segments) from the model output.

### 6. Bitmap Packing
- **Flow**: Converts the 1-channel tensors into 32-bit alpha-packed `ImageBitmaps` for transfer.
- **Files Involved**:
  - `processor.js`: Receives the array of candidates for lazy rendering in the UI.


## 6. Code Structure

- **extractMaskBitmap (Function)**:
  - Syntax: `async function extractMaskBitmap(data, width, height) { ... }`
  - Purpose: Tensor-to-Visibility engine.
  - Working: Thresholds the raw AI logits at 0.0. It uses bitwise packing `(val << 24) | 0x00ffffff` to generate a white subject on a transparent background inside an `OffscreenCanvas`.

- **onmessage (Handler)**:
  - Syntax: `self.onmessage = async ({ data }) => { ... };`
  - Purpose: The interactive lifecycle controller.
  - Working: Orchestrates the heavy/light inference split. It includes a specialized "Hardware Recovery" block that detects WebGPU TDR (Timeout Detection and Recovery) errors and invalidates the model state to force a clean reload.


## 7. Points To Consider

- **The Cache Invariant**: `cachedEmbeddings` is ONLY cleared when a new image is sent. This is what enables "Fluid Selection" where the user can click-and-drag markers and see the mask follow in real-time.

- **SAM-1 vs SAM-2 Protocol**: The worker dynamically switches between the `SamModel` and `Sam2Model` classes and their respective input tensor shapes. SAM-2 uses a 4D batch structure compared to SAM-1's 3D structure.

- **Thresholding Strategy**: Logits > 0.0 is the standard segmentation boundary for SAM. The worker performs this check on the CPU during the bit-packing phase to reduce GPU readback overhead.

- **Memory Disposal Danger**: Transformers.js manages tensor VRAM via an internal pool. Aggressive disposal of output tensors can cause "Device Lost" errors if the next refinement click is too fast. The worker preserves long-term assets but closes transient bitmaps.

- **High-Res Mask Invariant**: The worker MUST call `post_process_masks` using the `original_sizes` of the image (e.g. 4000px) rather than the internal `reshaped_input_sizes` (1024px). This ensures that segmentation edges remain sharp even when upscaled by the browser.
