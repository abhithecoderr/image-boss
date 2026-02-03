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
- **In-take Serialization**: Uses `createImageBitmap` (L58) for zero-copy transfer. Implements **1024px Input Capping** (L43) to support higher-fidelity SAM-2 inference.
- **Model-Aware Fingerprinting**: Cache logic now incorporates `modelId` to prevent cross-model embedding collisions.
- **Cache Signaling**: Tracks `lastImageFingerprint` (L35) to skip expensive bitmap transfers on refinement hits.
- **Workflow Phase**: Passes an array of coordinate objects (`{x, y, label}`) to the worker for multi-point prompting.
- **Result Reification**: `applyExtraction` (L101) and `applyRemoval` (L137) use **GPU-Accelerated Scaling**. They receive 768px mask buffers and project them to the original resolution using `ctx.drawImage`, bypassing the memory/CPU wall of high-res JS loop processing.

## File Code Structure

**`getWorker()`** (L11-16): Standard singleton instantiator for the background worker.

**`process(sourceCanvas, options, onProgress)`** (L25-67):
- **Point Mapping** (L26): Receives the full `points` array from `main.js`.
- **IPC Listener** (L37-61): Manages the `progress` -> `complete` cycle. Maps raw mask data from the worker into specific `Extract` or `Remove` canvas results depending on the active mode (L47).

**`applyExtraction(sourceCanvas, result)`** (L72-103):
- **Compositing** (L98): Draws the original image first, then uses `destination-in` with the scaled binary mask to "cut out" the object.

**`applyRemoval(sourceCanvas, result)`** (L132-177):
- **Mask Dilation** (L164-169): Uses `shadowBlur` to expand the AI mask slightly, eliminating halos.
- **Inpainting Loop** (L174): Passes the dilated mask to `surgicalInpaint` for background synthesis.

## Code Details

**`points: options.points`** (L65): Payload injection. Unlike legacy services, this passes the entire refinement history to the model for higher accuracy.

**`resultOptions.map`** (L47): Variation Generator. Converts the 3 AI-suggested masks into 3 distinct user-selectable candidates.
