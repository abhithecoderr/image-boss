# Context Map: background-removal/worker.js

## Purpose
Background thread execution for AI model inference. Manages the lifecycle of Transformers.js models (BiRefNet, MODNet, InSPyReNet), implements custom hardware acceleration mapping (WebGPU/WASM), and performs heavy-duty pixel-level mask refinements.

## Imports
- **@huggingface/transformers**: Core library for model loading and execution.

## Dependencies
- **Used by**: `processor.js` (via Web Worker IPC)
- **Uses**:
  - `AutoModel`, `AutoProcessor`, `RawImage` (Hugging Face ecosystem)
  - Browser GPU APIs (via `navigator.gpu`)

## Project Flow Connection
- **Hardware Initialization**: `getGPUConfig` (L22-46) detects WebGPU and the `shader-f16` extension.
- **Model Execution**: `loadModel` (L150-251) dynamically selects the best device/dtype based on hardware.
- **Inference Pipeline**: `self.onmessage` (L253-494) routes requests for full processing (`process`) or light-weight property updates (`refine`).
- **Memory Management**: `disposeTensors` (L51-64) ensures no hanging GPU buffers.

## File Code Structure

**`getGPUConfig()`** (L22-46): Async detection for WebGPU support.

**`disposeTensors(obj)`** (L51-64): Recursive cleanup for Transformers.js tensor objects.

**`applyFeathering(data, width, height, radius)`** (L80-113): Implements a 2-pass (horizontal/vertical) box blur on the 1D mask array.

**`sharpenEdgeValue(value, strength)`** (L122-132): Uses `Math.tanh` (L130) to tighten fuzzy mask edges in the transition zone.

**`extractAlphaMask(rawImage)`** (L137-148): Pulls the alpha channel (index 3) from RGBA output.

**`loadModel(modelId, onProgress)`** (L150-251): Complex router that handles specific architecture quirks (e.g., BiRefNet Swin-WASM forcing, L189).

**`self.onmessage` handler** (L253-494):
- **`process` branch** (L260-424): Model loading, inference, bilinear interpolation for mask scaling (L314-334), and edge sharpening.
- **`refine` branch** (L426-478): Instant mask updates using cached `lastMask` and `lastImage`.
- **`clear` branch** (L480-490): Resets internal state and optional model cache.

## Code Details

**`for loop i` in `process` branch** (L314-334): Manual bilinear interpolation used to scale low-res model outputs back to source dimensions. Injects normalized `dx/dy` weights to calculate final mask opacity.

**`if (!glConfig.hasF16)` block** (L165-170): Hardware fallback logic. Downgrades the `Transformers.js` loader from `dtype: 'fp16'` to `fp32` if the `shader-f16` WebGPU extension is absent.

**`async function loadModel()`** (L189-201): Architecture-specific guard. Forces `device: 'wasm'` for BiRefNet models on specific platforms to avoid known Swin-transformer ONNX driver crashes.

**`payload.bitmap.close()` call** (L419): Memory management executed immediately after `RawImage.fromCanvas` conversion to free GPU-resident transferable memory.
