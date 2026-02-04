# Context Map: chat/worker.js

## 1. Purpose
Local Large Language Model (LLM) engine utilizing the Liquid LFM 1.2B model. Provides a private, browser-native chat interface. Orchestrates the auto-regressive generation loop with real-time token streaming and instruction-following templates.

## 2. Imports
- **@huggingface/transformers**:
  - `AutoModelForCausalLM`: The core transformer model for text generation.
  - `AutoTokenizer`: Handles text-to-token encoding and Template application.
  - `TextStreamer`: Facilitates real-time token-by-token UI updates.

## 3. Dependencies
- **Uses**:
  - Hugging Face Hub (`LiquidAI/LFM2.5-1.2B-Instruct-ONNX`).
  - WebGPU (Primary) + WASM runtime.
- **Used by**:
  - [processor.js](file:///c:/projects/bg/my-ai-app/src/services/chat/processor.js) (IPC) - Routes prompts and accumulates streamed fragments.

## 4. State Management

- **model/tokenizer (Variables/Objects)**
  - **Syntax**: `let model = null; let tokenizer = null;`
  - **Purpose**: Global singletons for the LLM session. Pre-loaded to avoid the ~30 second Cold Start lag for 1.2B parameter models.

- **currentModelId (Variable/String)**
  - **Syntax**: `let currentModelId = null`
  - **Purpose**: Verification flag to prevent redundant model weights re-downloads.

## 5. Project Flow
1. **Bootstrap (Load)**: Downloads the `q4` (4-bit quantized) ONNX model.
2. **Contextualization (Template)**:
   - User input is wrapped in a **Chat Template** (L81).
   - Injects `<|user|>` and `<|assistant|>` markers required by the Liquid baseline to maintain role-play stability.
3. **Generation Pass (Auto-Regressive)**:
   - The model predicts the next token based on the prompt features.
   - The `TextStreamer` intercepts each token as it's predicted and forwards it back to the UI via IPC.
4. **Decoding (Synthesis)**:
   - Converts token IDs back into human-readable characters.
   - Implements **Prompt Leakage Prevention** (L113) by stripping the echoed prompt from the final result.
5. **Teardown**: Explicitly releases model resources on `dispose` command.

## 6. Code Structure

- **`loadModel` (Function)**
  - **Name (Type)**: loadModel (Lifecycle)
  - **Syntax**: `async function loadModel({ modelId, dtype, device })`
  - **Working**: Orchestrates the Int4 session creation. Uses **q4 Quantization** (L32) which is the critical theory allowing a 1.2B model to run in a browser's ~1GB memory limit.

- **`generate` (Function)**
  - **Name (Type)**: generate (Inference Core)
  - **Syntax**: `async function generate({ prompt, max_new_tokens, temperature })`
  - **Working**:
    - **System Alignment**: Injects a static "helpful assistant" system prompt (L75) to steer model behavior.
    - **Streaming Hook**: Instantiates the `TextStreamer` with `skip_prompt: true`. This ensures the UI only receives new tokens, not the internal markers.

- **Generation Loop (Block)**
  - **Name (Type)**: model.generate (Inference)
  - **Syntax**: `const output = await model.generate({ ...inputs, max_new_tokens, streamer });`
  - **Working**: The heavy lifting of the model. Iteratively consumes and produces tokens using the GPU's KV-cache.

## 7. Points To Consider
- **Quantization Requirements**: Note that `dtype` must be `"q4"` (L62) for the 1.2B model to fit within browser memory limits; higher-precision versions will likely trigger OOM.
- **UI Update Frequency**: Consider that the streamer callback can fire rapidly (L63); ensure the main-thread logic is optimized for high-frequency text updates.
- **Prompt Templates**: Note that `apply_chat_template` is vital (L64) for maintaining coherent role-play and preventing model hallucinations.
- **KV-Cache Management**: Consider that longer conversations consume more GPU memory; note that a worker reset may be needed (L65) if the system hangs after many rounds.
