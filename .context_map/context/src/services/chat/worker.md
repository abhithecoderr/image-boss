# Context Map: chat/worker.js

## Purpose
Off-thread execution for the local LLM (LiquidAI LFM 1.2B). Leverages Transformers.js to perform causal language modeling with WebGPU acceleration. Implements chat template application, streaming token generation, and safety-focused output cleaning.

## Imports
- **@huggingface/transformers**: `AutoModelForCausalLM`, `AutoTokenizer`, `TextStreamer`, `env`

## Dependencies
- **Used by**: `processor.js` (Worker IPC)
- **Uses**:
  - `LiquidAI/LFM2.5-1.2B` model weights
  - Transformers.js runtime for tokenization and inference

## Project Flow Connection
- **Setup Phase**: `loadModel` (L32-65) handles tokenizer and model loading, scaling progress from 20% to 100% (L51).
- **Inference Phase**: `generate` (L67-126) executes the chat loop. It applies "Instruct" templates (L81) and creates high-priority `TextStreamer` instances for real-time feedback.
- **Resource Recovery**: `onmessage` (L11-30) routes the `dispose` command to nullify references and free up large model buffers.

## File Code Structure

**`self.onmessage` handler** (L11-30): Central router for `load`, `generate`, and `dispose` lifecycle events.

**`loadModel(options)`** (L32-65):
- **WebGPU Deployment** (L44-56): Attempts to load the `q4` (4-bit) quantized model on the GPU.
- **Progress Tracking** (L47-55): Reports download intensity back to the UI.

**`generate(payload)`** (L67-126):
- **System Prompting** (L74-77): Injects the assistant identity.
- **Chat Templating** (L81-85): Uses the model's tokenizer to wrap user/system inputs in expected architectural markers.
- **Token Streaming** (L88-95): Hooks a `callback_function` into the generate loop for per-token IPC messages (L93).
- **Text Finalization** (L110-120): Performs a final decode and cross-compares with inputs to remove accidental prompt leakage (L116-118).

## Code Details

**`loadModel()` configuration** (L32): Explicitly targets `LiquidAI/LFM2.5-1.2B` using `dtype: 'q4'` (4-bit quantization). Reduces the LLM weight footprint to ~700MB for browser-local execution.

**`new TextStreamer()` instance** (L89-90): Configured with `skip_prompt: true`. This prevents the `AutoTokenizer` applied chat template from leaking into the final output.

**`if (full_response.startsWith(text))` sanitation** (L113-118): Safety check inside `generate`. Strips the echoed prompt from the response in case of architectural mismatch.
