# Context Map: upscaling/worker.js

## 1. Purpose
High-fidelity image upscaling using the Real-ESRGAN model via ONNX Runtime. Implements a tile-based processing pipeline to handle arbitrarily large images and a post-processing suite for detail restoration and color grading.

## 2. Imports
- **onnxruntime-web/webgpu**: The execution engine for the 4x upscaling model.

## 3. Dependencies
- **Uses**:
  - Hugging Face Hub (Model Structure/Weights).
  - JS Delivr CDN (WASM Runtime binaries).
- **Used by**:
  - [processor.js](file:///c:/projects/bg/my-ai-app/src/services/upscaling/processor.js) (IPC) - Primary command router.

## 4. State Management

- **session (Variable/Object)**
  - **Syntax**: `let session = null`
  - **Purpose**: Global singleton for the InferenceSession to prevent costly re-initialization.

- **cachedAIResult (Variable/OffscreenCanvas)**
  - **Syntax**: `let cachedAIResult = null`
  - **Purpose**: Persistence for the "Hot-Refinement" architecture. Stores the raw, sharp AI output to allow for instant filter adjustments.

- **cachedOriginalBitmap (Variable/ImageBitmap)**
  - **Syntax**: `let cachedOriginalBitmap = null`
  - **Purpose**: Reference for frequency separation; used to extract source textures for restoration.

- **currentDevice (Variable/String)**
  - **Syntax**: `let currentDevice = null`
  - **Purpose**: Tracks hardware status ('webgpu' vs 'wasm').

## 5. Project Flow
1. **Intake Stage**: Receives an `upscale` or `refine` command with an `ImageBitmap`.
2. **Turbo Pass (Optional)**: If the target scale is $<4\times$, the image is pre-downscaled to save GPU cycles (Turbo Mode).
3. **AI Tiling Pass**:
   - The image is divided into $128 \times 128$ tiles with a $16$px overlap.
   - Each tile is upscaled $4\times$ via the Real-ESRGAN session.
   - Tiles are stitched back together, discarding the overlapping "bleed" edges to prevent seams.
4. **Frequency Separation (Synthesis)**:
   - Extract "High-Frequency" detail from the original (Original - Blurred).
   - Inject this detail into the "Smooth" AI output to restore natural texture.
5. **Color Grading Stage**: Applies brightness and saturation adjustments to the final 32-bit buffer.
6. **Export**: Transfers a zero-copy `ImageBitmap` of the result.

## 6. Code Structure

- **Constants (Block)**
  - **Name (Type)**: Model Config (Constants)
  - **Syntax**: `const MAX_INPUT_SIZE = 128; const OVERLAP = 16; ...`
  - **Purpose**: Defines the tiling mathematics for the Real-ESRGAN model.

- **`fetchWithProgress` (Function)**
  - **Name (Type)**: fetchWithProgress (Utility)
  - **Syntax**: `async function fetchWithProgress(url, label, onProgress, startWeight, endWeight)`
  - **Working**: Streams binary data from a URL while calculating weight-based progress for the UI.

- **`getSession` (Function)**
  - **Name (Type)**: getSession (Lifecycle)
  - **Syntax**: `async function getSession(onProgress)`
  - **Working**: Orchestrates the dual-file fetch (structure + weights) and establishes the session. Includes WebGPU-to-WASM fallback logic.

- **`applyFilters` (Function)**
  - **Name (Type)**: applyFilters (Advanced Synthesis)
  - **Syntax**: `async function applyFilters(aiCanvas, originalBitmap, params, progressCallback)`
  - **Working**: Implements **Frequency Separation Theory**. It creates a blurred version of the original to find "detail deltas" (Original - Blur). These deltas are added back to the AI-generated pixels to defeat the "plastic" AI look. Also handles color grading.

- **`upscale` Pass (Branch in onmessage)**
  - **Name (Type)**: Tile Orchestrator (Branch)
  - **Working**: Executes the main tiling loop. For each tile, it handles physical extraction, edge clamping (for boundary tiles), tensor normalization, and surgical stitching into the output canvas.

- **`refine` Pass (Branch in onmessage)**
  - **Name (Type)**: Hot-Refinement (Branch)
  - **Working**: Instantaneous path. Skips the tiling loop and directly calls `applyFilters` on the cached AI results.

## 7. Points To Consider
- **Tiling Stride Mathematics**: Consider maintaining the stride as `MAX_INPUT_SIZE - (OVERLAP * 2)` (L78) to ensure high-quality center-cropping and seamless tile stitching.
- **Memory Hygiene**: Note that calling `bitmap.close()` is critical when replacing source images (L79) to prevent resource accumulation in the worker memory.
- **WASM Threading**: Consider enforcing `numThreads = 1` for WASM execution on lower-end hardware (L80) to avoid excessive resource contention during tiling.
- **Details Balance**: Note that frequency separation strength is typically capped at $1.5\times$ (L81); consider higher values only if the user explicitly requests extreme texture restoration.
