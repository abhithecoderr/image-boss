# Context Map: captioning/worker.js

## Purpose
Off-thread execution for the Florence-2 vision-language model. Leverages Transformers.js to execute local image-to-text inference with WebGPU acceleration and fp16 quantization for high-fidelity interactive captions.

## Imports
- **@huggingface/transformers**: `Florence2ForConditionalGeneration`, `AutoProcessor`, `RawImage`, `env`

## Dependencies
- **Used by**: `processor.js` (Worker IPC)
- **Uses**:
  - `onnx-community/Florence-2-base-ft` model
  - WebGPU compute (via browser API)

## Project Flow Connection
- **In-take Serialization**: Uses `RawImage.fromImageBitmap` (L38) for zero-copy transfer.
- **Workflow Phase**: Implements the dual-stage Florence-2 pipeline: `construct_prompts` -> `generate` -> `post_process_generation`.
- **Dtype Choice**: Uses `fp16` quantization to balance precision and memory footprint.

## File Code Structure

**`self.onmessage` handler** (L15-68):
- **Model Initialization** (L25-34): Loads the model and processor in parallel with `device: 'webgpu'` and `dtype: 'fp16'`.
- **Inference Execution** (L44-51): Prepares vision/text inputs and runs `model.generate`.
- **Result Packaging** (L55-60): Decodes IDs and applies `post_process_generation` for structured output.

## Code Details

**`env.backends.onnx.wasm.proxy = true`** (L11): Enables proxying for WASM/WebGPU to ensure smooth execution in a worker context.

**`task: '<MORE_DETAILED_CAPTION>'`** (L21): Default task prompt for high-detail vision analysis.
