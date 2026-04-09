# Decision Logs (Distilled)

## [Phase I: The Detection & Coordination Crucible]
- **Issue**: YOLO/Blur models returned unstable coordinates due to "Coordinate Domain Traps" (Pixel vs Normalized) and Transformers.js inconsistencies.
- **Decision**: Pivoted to raw `onnxruntime-web` for surgical control. Implemented Auto-Domain detection in the parser to normalize all outputs to [0-1] before scaling.

## [Phase II: The Hot-Refinement Era]
- **Issue**: 4K image processing caused 10s+ UI freezes and "High-Res Mask Walls."
- **Decision**: Implemented "Hot-Refinement" architecture. Split AI pipelines into heavy "Encoding" (cached) and fast "Decoding/Filter" (interactive) phases.
- **Implementation**: AI inputs capped at 1024px. Worker-side embedding/result caching. GPU-accelerated mask scaling via `ctx.drawImage` in processors.

## [Phase III: Transition to React Architecture]
- **Issue**: Modular vanilla JS architecture became difficult to manage as state interactions (SAM points + Manual Refinement + Service switching) grew complex.
- **Decision**: Refactored the entire application to React 18 / Vite.
- **Reasoning**: React provides robust lifecycle management and a declarative way to handle complex UI states. Componentization allows for better isolation of features like the `ComparisonSlider` and `SAMOverlay`.

## [Phase IV: Persistence & Model-Switching Fixes]
- **Issue**: Switching services lost previous results. Switching models *within* a service caused old results to linger on the canvas.
- **Decision**:
  1. Implemented `serviceResults` map in `AppContext` for persistence.
  2. Modified `useProcessor` and `Workspace` to explicitly clear rendering contexts when the result state is reset.
- **Implementation**: `useProcessor.process` now clears result state at start; `Workspace.jsx` watches for `null` state and clears the DOM canvas context immediately.

## [Phase V: InSPyReNet & BiRefNet Precision]
- **Issue**: High-end background removal models lost precision at small resolutions.
- **Decision**: Implemented model-specific target resolutions (Up to 1024px) and custom edge-sharpening parameters.
- **Implementation**: Added `modelSizes` registry in processors. Integrated GPU-accelerated `blur(1.2px)` during compositing to smooth AI upscaling artifacts.

## [Phase VII: Florence-2 Text-Grounded Segmentation]
- **Issue**: Standard segmentation requires manual points (SAM). Users wanted a way to segment objects via text description alone.
- **Decision**: Implemented Microsoft Florence-2 `<REFERRING_EXPRESSION_SEGMENTATION>` task.
- **Implementation**:
  1. Updated `worker.js` with 1024-token limit for complex polygons.
  2. Implemented "Mask Stack" rendering in `processor.js` (B&W Mask + Colorful Overlay).
  3. Added text-prompt UI in `ControlPanel.jsx` for text-to-mask conversion.

## [Phase VIII: Florence-2 Token & Prompt Fixes]
- **Issue**: Segmentation mode returned a black screen/raw string instead of polygons.
- **Root Cause**:
  1. Transformers.js v3 post-processor requires a space between the task tag and prompt text.
  2. The model outputs `<loc_XXX>` (with underscore), but the processor expects `<locXXX>` (no underscore) for parsing.
- **Decision**:
  1. Implemented prompt-spacing enforcement in `worker.js`.
  2. Implemented `<loc_` -> `<loc` sanitization in worker.
  3. Added a manual regex-based polygon parser in `processor.js` as a "Safety Net" fallback.

## [Phase IX: Brush-Based SAM Segmentation]
- **Issue**: Single-dot click gives SAM ambiguous context, leading to poor mask quality.
- **Decision**: Replaced dot-click with brush painting approach.
- **Implementation**:
  1. User paints over object → system derives bounding box + 8 sampled positive points.
  2. Both `input_boxes` and `input_points` are sent to SAM together.
  3. Added brush size slider in ControlPanel, replacing positive/negative toggle.
  4. Fixed `post_process_masks` bug: was using AI resolution instead of original image size.

 ## [Phase XI: Transformers.js v4 Upgrade]
 - **Issue**: BiRefNet triggered `concat`/`split`/`max buffers 8` WebGPU errors and cryptic `597685352` (DXGI_ERROR_DEVICE_RESET) crashes due to missing `GatherND`/`ScatterND` WebGPU kernels in v3's JS runtime, forcing CPU fallback that caused buffer-binding-limit overflow and GPU command queue exhaustion.
 - **Decision**: Upgraded `@huggingface/transformers` to the v4 `@next` preview tag. v4 ships a C++ WebGPU runtime co-developed with Microsoft's ONNX Runtime team, providing native `GatherND`, `ScatterND`, `Concat`, `Split` WebGPU kernels, eliminating the root cause.
 - **Implementation**:
   1. `package.json`: `"^3.8.1"` → `"next"`.
   2. `background-removal/worker.js`: Removed deprecated `env.useCustomValues`. Added post-load model warmup pass (compile shaders silently). Kept `graphCapture = false` as catch-and-retry guard.
   3. `object-segmentation/worker.js`: Added `getGPUConfig()` fp16 detection. Dynamic `device`/`dtype` selection (no longer hardcoded). Added warmup pass.
   4. `captioning/worker.js`: Promoted Florence-2 from `fp32` → `fp16` (guarded by fp16 check). Removed v3-specific `wasm.proxy = false`. Added `progress_callback` to model load.

 ## [Phase X: LaMa Inpainting Integration]
 - **Issue**: LaMa model failed in `lama.html` due to CORS errors, missing `SharedArrayBuffer` (threading), and "JSEP kernel" failures on WebGPU.
 - **Decision**: Implemented a custom ONNX Runtime Web integration with automatic WASM fallback.
 - **Implementation**:
   1. Upgraded to ORT 1.20.1 (`ort.all.min.js`) for `int64` support.
   2. Implemented `[-1, 1]` normalization in manual image-to-tensor helpers.
   3. Added `try-catch` wrapper around `session.run` to reload with the `wasm` provider if WebGPU fails during execution (handles FFC operator incompatibility).
   4. Fixed CORS by using Hugging Face `resolve` raw links.

## [Phase XII: Manual Mask-to-Result Synchronization]
- **Issue**: Manual mask edits (via `useMaskEditor`) were visual-only and lost during download because they weren't synced back to the global `resultCanvas`.
- **Decision**: Implement an explicit synchronization step at the end of drawing sessions to "bake" manual edits into `resultCanvas`.
- **Implementation**:
  1. Added `bakeMask` function to `useMaskEditor.js`.
  2. Triggered bake on `onMouseUp`/`onMouseLeave` (brush sessions).
  3. Ensured `resultCanvas` in `AppContext` is updated with a fresh canvas containing the composited result.
