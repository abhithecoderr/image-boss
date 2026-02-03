# Context Map: captioning/worker.js

## Purpose
Off-thread execution for the ViT-GPT2 image captioning model. Leverages Transformers.js to execute local image-to-text inference with WebGPU acceleration and 8-bit quantization (q8) for optimized browser performance.

## Imports
- **@huggingface/transformers**: `pipeline`, `env`

## Dependencies
- **Used by**: `processor.js` (Worker IPC)
- **Uses**:
  - `Xenova/vit-gpt2-image-captioning` model
  - WebGPU compute (via browser API)

## Project Flow Connection
- **Lifecycle**: Initializes the `image-to-text` pipeline lazily (L18) on the first request.
- **Feedback**: Sends granular download progress back to the main thread via `progress_callback` (L24).
- **Execution**: Runs the `captioner` function with specific generation tokens (L39).

## File Code Structure

**`self.onmessage` handler** (L12-55):
- **Model Initialization** (L18-34): Loads the model with `device: 'webgpu'` and `dtype: 'q8'`.
- **Inference Execution** (L39-42): Passes the image data and generation parameters (`max_new_tokens: 50`, `temperature: 0.7`).
- **Result Packaging** (L46-49): Extracts the `generated_text` and sends it back to the processor.

## Code Details

**`env.allowLocalModels = false` setting** (L8): Environment override to prevent the library from checking local disk paths, forcing remote fetching via the Hugging Face hub.

**`const captioner = await pipeline()`** (L23): Pipeline instantiation configured with `dtype: 'q8'` (8-bit quantization) to minimize WebGPU VRAM consumption.

**`try...catch` block** (L51-53): Global error boundary within the `onmessage` listener. Catches `OutOfMemory` or `ShaderCompilation` errors and propagates them as strings.
