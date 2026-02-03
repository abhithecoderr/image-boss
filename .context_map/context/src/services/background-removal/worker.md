# Context Map: background-removal/worker.js

## Purpose
Background thread execution for AI model inference. Manages the lifecycle of Transformers.js models (BiRefNet, MODNet, InSPyReNet), implements custom hardware acceleration mapping (WebGPU/WASM), and performs heavy-duty pixel-level mask refinements. Optimized for 1-channel raw mask transfer to enable GPU-accelerated scaling in the main thread.

## Imports
- **@huggingface/transformers**: Core library for model loading and execution.

## Dependencies
- **Used by**: `processor.js` (via Web Worker IPC)
- **Uses**:
  - `AutoModel`, `AutoProcessor`, `RawImage` (Hugging Face ecosystem)
  - Browser GPU APIs (via `navigator.gpu`)

## Project Flow Connection
- **Hardware Initialization**: `getGPUConfig` (L21-48) detects WebGPU and the `shader-f16` extension.
- **Model Execution**: `loadModel` (L152-252) dynamically selects the best device/dtype based on hardware.
- **Inference Pipeline**: `self.onmessage` (L255-420) routes requests for full processing (`process`) or light-weight property updates (`refine`).
- **Memory Management**: `disposeTensors` (L50-66) ensures no hanging GPU buffers.

## File Code Structure

**`getGPUConfig()`** (L21-48): Async detection for WebGPU support.

**`disposeTensors(obj)`** (L50-66): Recursive cleanup for Transformers.js tensor objects.

**`applyFeathering(data, width, height, radius)`** (L78-115): Implements a 2-pass (horizontal/vertical) box blur on the 1D mask array.

**`sharpenEdgeValue(value, strength)`** (L117-134): Uses `Math.tanh` (L132) to tighten fuzzy mask edges in the transition zone.

**`extractAlphaMask(rawImage)`** (L136-150): Pulls the alpha channel (index 3) from RGBA output.

**`loadModel(modelId, onProgress)`** (L152-252): Complex router that handles specific architecture quirks.

**`self.onmessage` handler** (L255-420):
- **`process` branch** (L261-386): Model loading, inference, and raw mask extraction. Returns 1-channel `Uint8Array` to save bandwidth.
- **`refine` branch** (L388-417): Instant mask updates using cached `lastMask` (raw probabilities) and `lastImage`.
- **`clear` branch** (L419-421): Resets internal state.

## Code Details

**`rawOutput` extraction** (L321, L341): Extracts the predicted alpha mask from the model output tensor.

**`res` return object** (L368, L413): Returns a 1-channel mask with `isRaw: true`. This prevents the CPU-heavy RGBA composition step in the worker.

**`lastMask` caching** (L270, L366): Stores raw inference data for sub-100ms slider refinements.
