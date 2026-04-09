# Realisations (Distilled)

## [Core Project Invariants]
- **The "Digital DNA" Sync**: HCM Protocol documentation is the project's immune system. Bypassing shadow map updates leads to "Context Drift" where the AI loses track of component interactions.
- **Coordinate Normalization**: Always communicate coordinates as percentages (0..1) between the UI overlay and the AI Worker. This ensures resolution independence across high-res sources and low-res AI caps.
- **The 1-Channel Mask Strategy**: Moving 1-channel `Uint8Array` masks to the main thread is 4x more efficient than full RGBA buffers. Use the Processor's GPU (`ctx.drawImage`) for final scaling and anti-aliased compositing.
- **Florence-2 Polygon Coarseness**: Florence-2 processes internally at 384x384 and outputs ~100-point polygons. This is ideal for "generative fill" (removal) where oversized/soft masks are better, but less suitable for pixel-perfect subject extraction.
- **The Box-Prompt Superiority**: For SAM, a bounding box provides significantly less ambiguity than a single dot. Deriving a box + sampled points from a rough brush stroke yields >50% better mask intersection (IoU) than a point-only prompt.

## [Performance Engineering]
- **Hot-Refinement Architecture**: Caching raw AI output (embeddings or masks) in the worker enables <100ms interactive adjustments (Blur radius, Sharpness, Points). The first pass is the "Heavy Tax"; subsequent refinements are "Free."
- **The Lazy Candidate Insight**: For multi-output tasks (like SAM), generating thumbnails first and deferring high-res synthesis until user selection is mandatory to prevent RAM exhaustion and UI stutter.
- **React vs. Canvas Performance**: Use React specifically for UI state and lifecycle management, but perform all pixel-level rendering via direct DOM access and `drawImage` in `useEffect` hooks to bypass React's reconciliation overhead.

## [Browser-Native AI Constraints]
- **Quantization Mandate**: Large models (>1B parameters) require 4-bit quantization (q4) and fp16 support to run on consumer hardware without OOM errors.
- **Model Warmup**: Explicitly perform a "zero-run" (warmup) during model initialization to compile WebGPU shaders, preventing a 3-5 second freeze during the user's first actual process.
- **Service Persistence**: Storing result canvases in a global map (`serviceResults`) is the preferred way to handle multi-tool workflows, allowing users to switch between "Blur" and "Upscale" without re-running AI passes.

## [UX Philosophy]
- **Surgical UI Feedback**: Use non-blocking toast notifications and high-frequency progress bars (throttled to 100ms) to make long-running AI tasks feel predictable and responsive.
- **Viewport Partitioning**: Visual results and textual outputs (Chat/Captions) require separate rendering domains. Never mix image overlays with conversational content to maintain readability.
- **The Mask WYSIWYG Gap**: Manual mask edits (via `useMaskEditor`) are decoupled from the global `resultCanvas` state. While visually correct in the workspace, these edits are "ephemeral" and lost during download unless explicitly synced back to the `resultCanvas`.

## [Worker Stability & Logic Guards]
- **IPC Safety**: Always wrap worker message handlers in try/catch blocks and send explicit 'error' types back to the main thread. Silent worker failures are the primary cause of unrecoverable UI hangs.
- **Resource Discipline**: Explicitly call `.close()` on `ImageBitmap` and `URL.revokeObjectURL` on blobs immediately after they are no longer needed. Browser GC is not aggressive enough for 4K image workflows.

 ## [WebGPU & Fourier Constraints]
 - **JSEP Kernel Gaps**: Models using Fast Fourier Convolutions (FFC) like LaMa often trigger JSEP kernel errors on WebGPU backends (specifically on `Add` or `Mul` nodes within the FFC block). In these cases, a runtime fallback to the `wasm` backend is necessary to maintain service stability without sacrificing the ability to attempt GPU acceleration first.
