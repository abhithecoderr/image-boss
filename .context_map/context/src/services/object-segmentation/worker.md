# Context Map: object-segmentation/worker.js

## Purpose
Background thread execution for interactive object segmentation. Supports a **Dual-Model Bridge**: SlimSAM (Fastest) and SAM-2 (Ultra-Precise/Hiera). Optimized for WebGPU with a 1024px AI vision cap and normalized multi-point refinement.

## Imports
- **@huggingface/transformers**: `SamModel`, `AutoProcessor`, `RawImage`, `env`

## Dependencies
- **Used by**: `processor.js` (IPC)
- **Uses**:
  - `Xenova/slimsam-77-uniform` (Speed)
  - `onnx-community/sam2.1-hiera-tiny-ONNX` (Precision)
  - Transformers.js v3+ runtime

## Project Flow Connection
- **Feature Extraction (Slow)**: Runs the SAM Encoder once per image to generate `image_embeddings`. (L83)
- **Hot-Refinement (Fast)**: Caches `image_embeddings` and `RawImage` (L14-25). Implements proactive `clearCache` (L18) and **Deep Disposal** (L168-175) to release GPU memory after every refinement pass.
- **IPC Loop**: Receives `bitmap` (new image) or `points` (refinement) via `onmessage`. Returns 3 serialized mask variants as **Transferable Uint8Arrays**.
- **Result Serialization**: Manually slices the `[1, 3, H, W]` mask tensor (L141). Optimized to target **Low-Res AI Domain** (768px) via `reshaped_input_sizes` (L119) to eliminate memory-intensive high-res mask reconstruction in JS.

## State Management
- `cachedEmbeddings`: Stores precomputed GPU features.
- `cachedRawImage`: Caches the `RawImage` instance for rapid re-processing.
- `lastImageInputs`: Stores original metadata (sizes) for post-processing.

## File Code Structure

**`bitmapToCanvas(bitmap)`** (L26-31): Utility to wrap transferable `ImageBitmap` into an `OffscreenCanvas`.

**`self.onmessage` handler** (L33-146):
- **Initialization** (L33-48): Loads model with `webgpu` and `fp16`.
- **Input Preparation** (L58-59): Transforms the `points` array into triple-nested `input_points` and `input_labels` tensors.
- **Inference Cycle** (L66): Executes the model to get raw prediction masks.
- **Post-Processing** (L75-79): Maps model-space masks to `original_sizes`.
- **Result Serialization** (L118-133): Accesses the multi-mask Tensor (`masks[0]`) and manually slices it into 3 distinct result objects (Small/Medium/Large scale) using `subarray`. Pre-formats into `Uint8Array` (0/255) for extraction logic.

## Code Details

**`input_points` & `input_labels`** (L93-100): Multi-point prompt schema. Implements **Dual-Format Logic**: 3D tensors for SlimSAM and 4D tensors `[batch, object, point, coord]` for SAM-2 to support its advanced spatial reasoning.

**`Post-Process Vision`** (L121): Internal resolution cap increased to **1024px** to match SAM-2's higher fidelity requirement while maintaining WebGPU safety via low-res masking.

**`masks[0]` Tensor Handling** (L92-98): Bypasses standard iteration blocks. Uses `dims` data to manually calculate offsets and extract individual variations from the flat memory buffer.
