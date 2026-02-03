# Context Map: chat/processor.js

## Purpose
Main-thread controller for the AI Chat service. Manages the lifecycle of a persistent Web Worker running a Large Language Model (LiquidAI/LFM). Implements a singleton worker pattern with a static callback registry to ensure seamless token streaming and initialization feedback.

## Imports
- **worker.js**: Loaded as a module-style Web Worker (L1)

## Dependencies
- **Used by**:
  - `main.js`: Primary interface for the conversational AI feature
- **Uses**:
  - `chat/worker.js`: Handles heavy LLM inference and token-by-token streaming

## Project Flow Connection
- **Worker Initialization**: `getWorker` (L16-50) attaches a permanent `onmessage` listener to prevent message drops during state transitions between loading and generating.
- **State Management**: Uses a centralized `callbacks` object (L5-10) to map worker IPC events (`token`, `loaded`, `complete`) to the currently active UI Promise.
- **Lifecycle**: `dispose` (L84-88) explicitly signals the worker to release GPU/RAM resources when the user leaves the chat interface.

## File Code Structure

**`callbacks` registry** (L5-10): Static object holding current `onProgress`, `onToken`, `resolve`, and `reject` functions.

**`getWorker()`** (L16-50): Singleton instantiator.
- **Message Router** (L21-47): Switch statement that routes IPC data based on `type`.
- **Stream Support** (L33-37): Immediately forwards individual tokens to the `onToken` callback for "typewriter" effects in the UI.

**`load(options, onProgress)`** (L52-62): Async function to trigger model downloading and WebGPU compilation.

**`generate(prompt, onToken, options)`** (L65-82): Primary prompt interface. Sets up the token callback and resolves with the final clean text output.

**`dispose()`** (L84-88): Sends a `dispose` message to the worker for resource cleanup.

## Code Details

**`getWorker()` singleton listener** (L20): Attaches a permanent `onmessage` callback using a `switch` statement once per application session.

**`callbacks[type](data.content)` call** (L35-36): Event dispatcher. Routes streaming `token` messages directly to the UI-bound generator without pending a `generate` Promise.

**`new Promise((res, rej) => ...)` wrapper** (L57-59, L70-72): Bridging logic in `load` and `generate` methods. Maps anonymous worker responses back to localized async controls.
