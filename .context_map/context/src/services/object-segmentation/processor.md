# Context Map: object-segmentation/processor.js

## 1. Purpose
Management layer for interactive object segmentation. Orchestrates the two-stage SAM lifecycle (Encoding/Decoding) and provides specialized rendering modes for Object Extraction (transparent PNG) and Object Removal (Inpainting).

## 2. Imports
- **worker.js?worker**: The background thread implementation.
- **../../core/canvas-utils.js**: `surgicalInpaint` - used for the removal workflow.

## 3. Dependencies
- **Uses**:
  - [worker.js](file:///c:/projects/bg/my-ai-app/src/services/object-segmentation/worker.js): Background AI thread.
- **Used by**:
  - `main.js`: Main UI orchestrator.

## 4. State Management

- **worker (Variable/Worker)**
  - **Syntax**: `let worker = null`
  - **Purpose**: Lazy-loaded singleton for the SAM worker thread.

- **lastImageFingerprint (Variable/String)**
  - **Syntax**: `let lastImageFingerprint = null`
  - **Purpose**: Tracks image dimensions to avoid redundant 2-second Encoding passes on the same image.

## 5. Project Flow
1. **Identification**: `main.js` delivers a click-point coordinate (normalized 0-1).
2. **Analysis (The Fingerprint Check)**: The processor checks if the image has changed. If so, it triggers the "Heavy Encoder" in the worker.
3. **Delegation**: Point data is sent to the worker via IPC.
4. **Synthesis (Interaction Loop)**:
   - Worker returns a triplet of **MaskCandidates**.
   - These are "Lazy" objects—they generate fast 120px thumbnails for the sidecar UI (Layer Picker) without the overhead of full-res rendering.
5. **Execution (The Render Mode)**:
   - **Extraction**: Applies `destination-in` masking to create a cutout.
   - **Removal**: Injects the mask into `surgicalInpaint` to "heal" the background.
6. **Return**: The final result canvas is returned to the workspace.

## 6. Code Structure

- **`MaskCandidate` (Class)**
  - **Name (Type)**: MaskCandidate (Data Object)
  - **Purpose**: Wraps a single AI mask result for lazy rendering.
  - **Methods**:
    - `getThumbnail()`: Low-res preview generation.
    - `render()`: Full-res final synthesis.

- **`process` (Function)**
  - **Name (Type)**: process (Primary Entry Point)
  - **Syntax**: `export async function process(sourceCanvas, options = {}, onProgress)`
  - **Working**: Orchestrates the fingerprinting and worker communication. Includes an internal downscaling step (1024px) for the AI bridge to prevent encoder timeouts.

- **`applyExtraction` (Function)**
  - **Name (Type)**: applyExtraction (Visual Core)
  - **Syntax**: `function applyExtraction(sourceCanvas, candidate)`
  - **Working**: Performs high-speed binary masking. Uses a low-res mask canvas upscaled via GPU `drawImage` to fit the source.

- **`applyRemoval` (Function)**
  - **Name (Type)**: applyRemoval (Advanced Synthesis)
  - **Syntax**: `function applyRemoval(sourceCanvas, candidate)`
  - **Working**: Implements **Dilation Pre-Pass**. It applies a small shadow blur to the mask before inpainting to ensure the "Edge Halos" of the removed object are completely consumed by the diffusion algorithm.

## 7. Points To Consider
- **Lazy Candidate Strategy**: Consider waiting for a user selection before rendering full-resolution canvases (L63) to prevent unnecessary RAM spikes from the SAM triplet.
- **Fingerprint Hygiene**: Note that correctly nullifying `lastImageFingerprint` (L64) after an error is important to ensure subsequent calls can successfully re-initialize embeddings.
- **Bleed Prevention**: Consider using a dilation pre-pass in `applyRemoval` (L65) to ensure object "halos" are fully consumed by the inpainting algorithm.
