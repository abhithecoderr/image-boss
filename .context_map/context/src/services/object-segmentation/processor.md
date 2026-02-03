# Context Map: object-segmentation/processor.js

## Purpose
Main-thread orchestrator for the interactive object segmentation feature. Manages the communication with a SlimSAM worker, handles multi-point coordinate mapping (refinement dots), and implements a result-grid system for selecting between multiple extraction or removal variations. Integrates `surgicalInpaint` for the removal path.

## Imports
- **worker.js**: Loaded as a dedicated Web Worker (L6)
- **surgicalInpaint**: Utility for removal mode (L7)

## Dependencies
- **Used by**:
  - `main.js`: Primary interface for the "Object Select" tool
- **Uses**:
  - `object-segmentation/worker.js`: Executes SlimSAM inference and mask generation
  - `core/canvas-utils.js`: For inpainting and extraction compositing

## Project Flow Connection
- **In-take Serialization**: Uses `createImageBitmap` (L101) for zero-copy transfer. Implements **1024px Input Capping** (L83) to support higher-fidelity SAM-2 inference.
- **Model-Aware Fingerprinting**: Cache logic now incorporates `modelId` to prevent cross-model embedding collisions.
- **Cache Signaling**: Tracks `lastImageFingerprint` (L77) to skip expensive bitmap transfers on refinement hits.
- **Workflow Phase**: Passes an array of coordinate objects (`{x, y, label}`) to the worker for multi-point prompting.
- **Lazy Candidate Pattern (NEW)**: Returns `MaskCandidate` instances instead of canvases. This prevents blocking the main thread with three sequential extraction/inpainting operations.
- **GPU-Accelerated Scaling**: `applyExtraction` (L161) and `applyRemoval` (L195) receive 768px mask buffers and project them to the original resolution using `ctx.drawImage`, bypassing the memory/CPU wall of high-res JS loop processing.

## File Code Structure

**`MaskCandidate` Class** (L22-80):
- **Lazy Wrapper**: Encapsulates 1-channel mask data and metadata.
- **`getThumbnail()`** (L43-69): Generates a 120px picker preview instantly using canvas scaling on the low-res mask.
- **`render(sourceCanvas, mode)`** (L75-80): Orchestrates the heavy rendering only when selected by the user.

**`process(sourceCanvas, options, onProgress)`** (L88-147):
- **Return Type**: Now returns `options: MaskCandidate[]`.
- **IPC Listener** (L128-142): Converts worker results into `MaskCandidate` instances.

**`applyExtraction(sourceCanvas, candidate)`** (L161-190):
- **Compositing**: Draws the original image first, then uses `destination-in` with the scaled binary mask to "cut out" the object.

**`applyRemoval(sourceCanvas, candidate)`** (L195-230):
- **Mask Dilation**: Uses `shadowBlur` (L225) to expand the AI mask slightly, eliminating halos.
- **Inpainting Loop**: Passes the dilated mask to `surgicalInpaint` for background synthesis.
