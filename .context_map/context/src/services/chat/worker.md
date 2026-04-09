# Context Map: chat/worker.js


## 1. Purpose

The persistent background thread for the LiquidAI LFM-2.5B model. It manages massive token generation tasks using Transformers.js, implements real-time text streaming via the `TextStreamer` API, and handles the conditional formatting of user/assistant messages using model-specific chat templates.


## 2. Imports

- **Transformers.js**:
  - Syntax: `import { AutoModelForCausalLM, AutoTokenizer, TextStreamer, env } from "@huggingface/transformers";`
  - Purpose: Core LLM framework for local 4-bit quantized inference.


## 3. Dependencies

- **Used by**:
  - `processor.js` (The main-thread communicator).

- **External APIs**:
  - **WebGPU / WASM**: Hardware targets.
  - **navigator.storage**: (Implicitly via `useBrowserCache`) for multi-hundred megabyte model persistence.


## 4. State Management

- **model / tokenizer (Variables)**:
  - Syntax: `let model = null; let tokenizer = null;`
  - Purpose: Persistent AI engine references. These are multi-hundred megabyte assets that must stay in memory throughout the session.


### 1. Load Phase
- **Flow**: Downloads and initializes the tokenizer and quantized (`q4`) model weights.
- **Files Involved**:
  - `@huggingface/transformers`: Orchestrates the download of multi-gigabyte LFM model shards.

### 2. Template Application
- **Flow**: Converts user prompts into the exact string format expected by the model.
- **Files Involved**:
  - `@huggingface/transformers`: Uses the specialized tokenizer to apply chat templates (e.g. `<|user|>`).

### 3. Inference Loop
- **Flow**: Starts the `model.generate` loop.
- **Files Involved**:
  - `@huggingface/transformers`: Executes the Causal LM auto-regressive decoding.

### 4. Streaming
- **Flow**: Hooks into the `TextStreamer` callback to send generated tokens back to the main thread *as they are predicted*.
- **Files Involved**:
  - `processor.js`: Receives real-time token events for incremental UI updates.

### 5. Post-processing
- **Flow**: Decodes the final token array and performs "Prompt Leak" sanitization.


## 6. Code Structure

- **loadModel (Function)**:
  - Syntax: `async function loadModel({ modelId, dtype, device }) { ... }`
  - Purpose: Hardware-accelerated weight loading.
  - Working: Performs a singleton check on `currentModelId`. It uses the `progress_callback` to broadcast download progress from 20% to 100% of the UI status bar.

- **generate (Function)**:
  - Syntax: `async function generate({ prompt, max_new_tokens, temperature }) { ... }`
  - Purpose: The text generation engine.
  - Working: Defines a `system` prompt ("You are a helpful assistant"), applies the chat template, initializes the `TextStreamer`, and invokes the auto-regressive decoder. It includes a specific `skip_prompt: true` flag in the streamer to prevent echoed tokens.


## 7. Points To Consider

- **Template Invariant**: Instruct models like LFM require strict chat templates. The use of `tokenizer.apply_chat_template` is mandatory for preventing the AI from generating gibberish or losing its instruction-following capability.

- **Streaming UX Power**: The `TextStreamer` callback is the primary driver of the "Lush AI" feel of the chat interface. It ensures the user sees activity within milliseconds of pressing Enter.

- **Memory Sanitization**: The hook includes a `.startsWith(decodedInput)` check during post-processing. This is a crucial safety guard against certain ONNX backends that include the input prompt in the returned output buffer.

- **Quantization strategy**: The worker defaults to `dtype: "q4"`. This reduces the RAM footprint of the 1.2B parameter model to ~1.2GB, making it viable for 16GB consumer machines.
