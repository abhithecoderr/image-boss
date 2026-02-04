# Realisations (Distilled)

## [Core Project Invariants]
- **The "Digital DNA" Sync**: HCM Protocol v7.1 is the project's immune system. Bypassing Phase Zero (Context Immersion) or ignoring "Points To Consider" leads into well-documented "Coordinate Domain Traps."
- **Coordinate Normalization**: Always communicate coordinates as percentages (0..1) between threads. This is the only way to maintain resolution independence across different internal caps (768px vs 4096px).
- **The 1-Channel Mask Strategy**: Moving 1-channel `Uint8Array` masks is 4x more efficient than RGBA. Let the Processor's GPU (`ctx.drawImage`) handle the heavy lifting of scaling and compositing.

## [Performance Engineering]
- **Hot-Refinement Architecture**: Caching the raw AI structural output (embeddings or masks) enables <200ms interactive adjustments for sliders (Radius, Details, Color). The first AI pass is the "Heavy Tax"; subsequent refinements are "Free."
- **The Lazy Candidate Insight**: For multi-output AI tasks, generating thumbnails first and deferring high-res synthesis until user selection is mandatory to prevent RAM exhaustion and UI stutter.
- **WebGPU Memory Hygiene**: Explicit `.dispose()` is vital for model weights, but must be avoided for active refinement tensors. Persistent state is the engine of interactivity.

## [Browser-Native AI Constraints]
- **Quantization Mandate**: 1B+ parameter models (like Liquid LFM) require q4 quantization. Attempting fp16/fp32 in the browser is a guarantee for OOM on consumer hardware.
- **Format Interoperability**: returning 0-1 Floats to a thread expecting 0-255 Unsigned Integers creates "Ghost Results." Unified domain enforcement in the worker is a foundational requirement.
- **Display Buffer Synchronicity**: `updateResultDisplay` must be whitelisted for every new service to prevent silent failures. Invariants in `main.js` drive the visual truth of the application.

## [UX Philosophy]
- **Partitioned Results**: Visual and Textual AI outputs belong in separate viewport domains. Text results (Captions/Chat) deserve high-readability typography, not just visual overlays.
- **Interactive Refinement UI**: Shift-click for subject selection and Red/Green marker types are superior to legacy right-click interactions for discoverability and touch support.
