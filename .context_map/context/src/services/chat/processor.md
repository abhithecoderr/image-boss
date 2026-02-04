# Context Map: chat/processor.js

## 1. Purpose
Management layer for the local AI chat service. Orchestrates the Liquid LFM worker lifecycle, manages token streaming callbacks, and provides a singleton bridge for the main thread.

## 2. Imports
- **worker.js?worker**: The background thread implementation.

## 3. Dependencies
- **Uses**:
  - [worker.js](file:///c:/projects/bg/my-ai-app/src/services/chat/worker.js): Background LLM thread.
- **Used by**:
  - `main.js`: Primary UI orchestrator for the chat feature.

## 4. State Management

- **worker (Variable/Worker)**
  - **Syntax**: `let worker = null`
  - **Purpose**: Lazy-loaded singleton for the chat thread.

- **callbacks (Variable/Object)**
  - **Syntax**: `const callbacks = { ... }`
  - **Purpose**: Router for asynchronous worker events (Progress, Tokens, Resolve/Reject).

## 5. Project Flow
1. **Bootstrap**: `load()` is called to initialize the LLM.
2. **Registration**: The processor implements a **Permanent Message Listener** (L21). Unlike other processors that attach/detach listeners per-call, the chat processor maintains a single listener that routes messages to the specialized `callbacks` object.
3. **Execution**: When `generate()` is called, the processor routes the prompt to the worker.
4. **Synthesis (Streaming)**:
   - As tokens arrive from the worker, the `onToken` callback is triggered.
   - This allows `main.js` to update the chat bubble character-by-character.
5. **Collection**: Once generation is complete, the `resolve` callback returns the full string for final archival.

## 6. Code Structure

- **`getWorker` (Function)**
  - **Name (Type)**: getWorker (Singleton Helper)
  - **Syntax**: `function getWorker()`
  - **Working**: Implements the permanent listener strategy. This is a critical design decision to prevent "orphaned tokens" during the transition between the `load` and `generate` operations.

- **`load` (Function)**
  - **Name (Type)**: load (Lifecycle)
  - **Syntax**: `export function load(options = {}, onProgress)`
  - **Working**: Triggers the 700MB model download. Returns a Promise that resolves when the model is in VRAM.

- **`generate` (Function)**
  - **Name (Type)**: generate (Inference Trigger)
  - **Syntax**: `export function generate(prompt, onToken, options = {})`
  - **Working**: The bridge for the auto-regressive generation loop. Subscribes the UI's `onToken` handler to the internal worker message stream.

## 7. Points To Consider
- **Listener Uniqueness**: Consider attaching the listener only once (L52) to prevent double-typing bugs and duplicated token output in the UI.
- **Worker Recycling**: Note that calling `load` with a new `modelId` (L53) will automatically replace the previous instance, managing memory efficiently.
- **Main Thread Smoothness**: Consider using `requestAnimationFrame` for rendering token updates (L54) if high-frequency IPC messages start to cause UI lag.
