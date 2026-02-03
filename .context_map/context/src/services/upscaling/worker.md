# Context Map: upscaling/worker.js

## Purpose
Background thread execution for high-fidelity image upscaling using Real-ESRGAN. Implements a sophisticated tile-based inference engine to bypass GPU memory limits, a "Turbo" downscaling optimization for fractional scales, and a "Hot-Refinement" architecture that caches AI results for instant parameter adjustments.

## Imports
- **onnxruntime-web/webgpu**: Direct ONNX execution engine.

## Dependencies
- **Used by**: `processor.js` (IPC)
- **Uses**:
  - `TheGuy444/Real-ESRGAN-ONNX` (Model + Data)
  - WebGPU/WASM runtime (via ONNX Runtime)

## Project Flow Connection
- **Session Management**: `getSession` (L66-106) lazily loads the split `.onnx` and `.data` files.
- **Refinement Cache**: `cachedAIResult` and `cachedOriginalBitmap` (L109-112) enable sub-100ms slider updates.
- **Tiling Loop**: Iterates over 128x128 tiles with overlap/stride logic (L241-325) to prevent edge artifacts.
- **Filter Pass**: `applyFilters` (L118-193) consolidates Frequency Separation and color grading into a reusable, lightweight function.

## File Code Structure

**`fetchWithProgress(url, label, ...)`** (L33-64): Custom XHR-like wrapper for `fetch`.

**`getSession(onProgress)`** (L66-106): Detects WebGPU and falls back to WASM.

**`applyFilters(aiCanvas, originalBitmap, params, ...)`** (L118-193): Lightweight post-processing loop. Performs detail injection and color grading.

**`self.onmessage` handler** (L195-367):
- **Hot-Refinement Check** (L204-213): Determines if the heavy AI pass can be skipped based on `type` and `payload`.
- **Tiling Stitching Loop** (L241-325): Complex sequential processing of patches. Results are cached into `cachedAIResult` (L330).
- **Filter Execution** (L343): Triggers `applyFilters` for both full `upscale` and rapid `refine` requests.

## Code Details

**`cachedAIResult` persistence** (L109): Stores the `OffscreenCanvas` containing the raw AI structure. This is the "Pivot Point" for all subsequent slider refinements.

**`isRefine` logic** (L205): Strategic bypass of the `sess.run` tiling loop. If only brightness or details change, the worker resolves using the existing cache.

**`Frequency Separation`** (L137-148): Surgical Detail Injection. Sharpens the AI result by adding back high-frequency content extracted from the original source.
