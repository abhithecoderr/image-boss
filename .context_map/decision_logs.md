# Decision Logs (Distilled)

## [Phase I: The Detection & Coordination Crucible]
- **Issue**: YOLO/Blur models returned unstable coordinates due to "Coordinate Domain Traps" (Pixel vs Normalized) and Transformers.js v3 incompatibilities.
- **Decision**: Pivoted to raw `onnxruntime-web` (ORT) for surgical control. Implemented Auto-Domain detection in the parser to normalize all outputs to [0-1] before scaling.
- **Implementation**: Refactored `blur/worker.js` with a robust YOLOv10-style parser and IoU-based NMS.

## [Phase II: Architectural Resync & Logic Guards]
- **Issue**: UI race conditions (`isProcessing` locks) and uninitialized result pointers caused silent rendering failures.
- **Decision**: Implemented strict whitelisting in `updateResultDisplay` and whitelast result pointers.
- **Implementation**: Added `{}` scoping to `main.js` switch cases to prevent variable redeclaration; integrated `statusBar.classList.add('hidden')` in global `finally` blocks.

## [Phase III: The Hot-Refinement Optimization Era]
- **Issue**: 4K image processing caused 10s+ UI freezes and "High-Res Mask Walls."
- **Decision**: Implemented "Hot-Refinement" architecture. Split AI pipelines into heavy "Encoding" (cached) and fast "Decoding/Filter" (interactive) phases.
- **Implementation**: (1) AI inputs capped at 1024px. (2) Worker-side embedding/result caching. (3) GPU-accelerated mask scaling via `ctx.drawImage` in processors.

## [Phase IV: Subject-Centric Interaction Evolution]
- **Issue**: Multi-point subject selection was confusing; rendering multiple high-res variations caused RAM spikes.
- **Decision**: Implemented "Lazy Candidate" pattern and "Refine-with-Shift" interaction model.
- **Implementation**: `MaskCandidate` objects defer high-res synthesis until selection. Integrated SAM-2 for precision while retaining SlimSAM for speed.

## [Phase V: Multimodal Foundation & UI Partitioning]
- **Issue**: Legacy captioning and chat models were underpowered and UI-cluttered.
- **Decision**: Migrated to Florence-2 (Vision) and Liquid LFM (LLM) with Int4/fp16 quantization. Partitioned viewports to separate visual artifacts from textual results.
- **Implementation**: Zero-copy `ImageBitmap` transfers for Florence-2; `TextStreamer` integration for real-time local chat.

## [Current]
- **Prompt**: "Move to phase 2: Summarizing lore and updating Section 7."
- **Reasoning**: To maintain context density and prevent token bloat while transitioning to the advisory HCM Protocol v7.1.
- **Implementation**: Standardized all shadow files to "Points To Consider" and archived last 50+ logs into 5 architectural distillations.
