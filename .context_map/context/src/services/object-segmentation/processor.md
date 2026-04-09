# Context Map: object-segmentation/processor.js


## 1. Purpose

The main-thread interface for the Segment Anything Model (SAM). It orchestrates "Lazy Result Rendering," manages the image embedding cache to enable zero-lag interactive refinement, and implements both extraction (foreground isolate) and removal (surgical inpaint) visual logic.


## 2. Imports

- **Worker**:
  - Syntax: `import Worker from './worker.js?worker';`
  - Purpose: Initializes the SAM inference thread.

- **surgicalInpaint**:
  - Syntax: `import { surgicalInpaint } from '../../core/canvas-utils.js';`
  - Purpose: Utility for "Healing" the background when a subject is removed.


## 3. Dependencies

- **Used by**:
  - `useProcessor.js` (Primary execution path).
  - `useSAM.js` (Specialized interactive selection path).

- **External APIs**:
  - **Canvas API (ShadowBlur)**: Used as a synthetic GPU dilation operator for mask feathering.


## 4. State Management

- **lastImageFingerprint (Variable)**:
  - Syntax: `let lastImageFingerprint = null;`
  - Purpose: Stores the resolution of the most recent image. Used to determine if the worker needs to re-run the heavy Encoder phase or can reuse existing embeddings.


### 1. Embedding Check
- **Flow**: If the image or model hasn't changed, it bypasses the image transfer and tells the worker to use its internal `cachedEmbeddings`.

### 2. Downsizing
- **Flow**: High-res images are downscaled to 1024px before being sent to the AI to prevent worker OOM (Out of Memory) errors.

### 3. Inference
- **Flow**: Worker runs the SAM Decoder (extremely fast).
- **Files Involved**:
  - `worker.js`: Executes the lightning-fast prompt-to-mask decoding phase.

### 4. Lazy Realization
- **Flow**: Instead of generating three 4K canvases, the processor returns `MaskCandidate` classes. These contain the raw mask bitmaps and can generate thumbnails instantly.

### 5. Final Render
- **Flow**: When the user selects a candidate, `candidate.render()` is called, applying either the `applyExtraction` filters or the `applyRemoval` inpainting.
- **Files Involved**:
  - `canvas-utils.js`: Provides `surgicalInpaint` for subject removal tasks.


## 6. Code Structure

- **MaskCandidate (Class)**:
  - Syntax: `class MaskCandidate { ... }`
  - Purpose: Memory-safe result container.
  - Working: Holds a reference to the transferred `ImageBitmap`. It provides a `getThumbnail()` method for the interactive rail and a `render()` method that performs full-resolution compositing.

- **process (Function)**:
  - Syntax: `export async function process(sourceCanvas, options = {}, onProgress) { ... }`
  - Purpose: The interactive inference orchestrator.
  - Working: Handles the "Image Fingerprinting" logic. It manages the hand-off to the worker, transferring the `points` and the optional `box` (bounding box) parameters, and resolves with the array of `MaskCandidate` objects.

- **applyRemoval (Function)**:
  - Syntax: `function applyRemoval(sourceCanvas, candidate) { ... }`
  - Purpose: Surgical object deletion.
  - Working: Creates a 2x dilated mask using a 2D canvas `shadowBlur` trick (GPU-accelerated) before passing the pixels to the `surgicalInpaint` utility.


## 7. Points To Consider

- **The Fingerprint Invariant**: `lastImageFingerprint` is the core of SAM's performance. It ensures that clicking 10 different spots on the same image only requires ONE heavy "Encoding" pass, making subsequent "Decoding" blazingly fast (~50ms).

- **Lazy Rendering Pattern**: We never render all three SAM masks at full resolution. This saves gigabytes of temporary VRAM and CPU time, rendering only the one the user actually clicks.

- **Dilation Logic**: For removal, we use `mCtx.shadowBlur = 8` to expand the AI's mask by a few pixels. This ensures no "ghosting" edges remain after the `surgicalInpaint` process.

- **Coordinate Scaling**: The AI works at 1024px, but results are applied to the original `sourceCanvas` resolution. The `ctx.drawImage` call handles this scaling automatically via the browser's hardware interpolator.
