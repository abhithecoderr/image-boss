# Context Map: captioning/worker.js

## 1. Purpose
Multimodal image description engine utilizing the Florence-2 vision model. Orchestrates the full generative lifecycle: from raw pixel feature extraction to tokenized auto-regressive text generation. Supports multiple vision tasks via a unified prompt-based interface.

## 2. Imports
- **@huggingface/transformers**:
  - `Florence2ForConditionalGeneration`: The core generative vision-language model.
  - `AutoProcessor`: Manages the complex intersection of pixel encoding and text tokenization.
  - `RawImage`/`env`: Data structures and hardware acceleration controls.

## 3. Dependencies
- **Uses**:
  - Hugging Face Hub (`onnx-community/Florence-2-base-ft`).
  - WebGPU (Primary Hardware Target) + WASM runtime.
- **Used by**:
  - [processor.js](file:///c:/projects/bg/my-ai-app/src/services/captioning/processor.js) (IPC) - Routes user-selected tasks and handles result synthesis.

## 4. State Management

- **model/processor (Variables/Objects)**
  - **Syntax**: `let model = null; let processor = null;`
  - **Purpose**: Global singletons for the Florence-2 session. These are kept in memory due to their significant size (~250MB+), ensuring subsequent generation calls avoid initialization lag.

## 5. Project Flow
1. **Intake**: Receives an `ImageBitmap` and a task identifier (e.g., `<MORE_DETAILED_CAPTION>`).
2. **Alignment (Input Prep)**:
   - The `processor` converts raw pixels into visual tokens.
   - It constructs the textual prompt based on the selected vision task (L73).
3. **Inference (The Generation Pass)**:
   - The model executes an auto-regressive generation loop.
   - It predicts tokens one-by-one (up to 100 tokens) using the combined vision-text features.
4. **Structural Synthesis**:
   - The generated token IDs are decoded into raw text via `batch_decode`.
   - `post_process_generation` (L86) parses the raw text into structured JSON metadata (splitting coordinates, labels, and text).
5. **Export**: The final refined string and structured raw results are transferred back to the main thread.

## 6. Code Structure

- **Hardware Config (Block)**
  - **Name (Type)**: env (Configuration)
  - **Syntax**: `env.backends.onnx.wasm.proxy = false;`
  - **Purpose**: Disables WASM proxying to prevent IPC synchronization deadlocks within the worker environment.

- **Initialization Logic (Block)**
  - **Name (Type)**: Model Loader (Lifecycle)
  - **Syntax**: `model = await Florence2ForConditionalGeneration.from_pretrained(...)`
  - **Working**: Implements **Surgical Precision Fallback**. It attempts to load the `fp16` model via WebGPU first for maximum speed. If the hardware lacks `shader-f16` capabilities, it automatically re-attempts with `fp32` (L54).

- **Prompt Construction (Block)**
  - **Name (Type)**: construct_prompts (Processor)
  - **Syntax**: `const prompts = processor.construct_prompts(task);`
  - **Purpose**: Maps high-level UI requests to the specific internal "Vision Task Tokens" used by Florence-2.

- **Generation Lifecycle (Block)**
  - **Name (Type)**: model.generate (Inference)
  - **Syntax**: `const generated_ids = await model.generate({ ...inputs, max_new_tokens: 100 });`
  - **Working**: Triggers the transformer's decoder. It uses the visual features as "context" to predict the most likely descriptive text sequence.

- **Hardware Recovery (Block)**
  - **Name (Type)**: Error Handler (Cleanup)
  - **Working**: Specifically intercepts numeric WebGPU errors (OOM) and converts them into human-readable hardware alerts (L104).

## 7. Points To Consider
- **Thread Proxying Configuration**: Note that `wasm.proxy` should remain `false` (L65) to ensure the ONNX runtime can communicate directly with worker-shared buffers without deadlocks.
- **Task Token Accuracy**: Consider that the `task` string (e.g., `<DETAILED_CAPTION>`) must match the Florence-2 registry exactly (L66) for the model to behave correctly.
- **Memory Pressure**: Note that Florence-2 is memory-intensive; consider checking for WebGPU OOM errors if processing images exceeding 1024px (L67).
- **Post-Processing**: Consider that `post_process_generation` is necessary (L68) to clean tasks tags and coordinate markers from the raw output string.
