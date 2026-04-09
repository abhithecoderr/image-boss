# Context Map: chat/processor.js

## 1. Purpose
The main-thread interface for the Image Chat service. It manages a long-running LLM worker and handles streaming text responses for a conversational UI.

## 2. Imports
- **Worker**: `worker.js` - The LLM engine.

## 3. Dependencies
- **Provided to**:
  - [useChat.js](file:///c:/projects/bg/my-ai-app/src/hooks/useChat.js)

## 4. State Management
- **worker (Singleton)**: Persistent instance to maintain LLM context (KV Cache).
- **isReady**: Tracks model availability.

## 5. Project Flow
1. **Init**: Loads the quantized LLM weights.
2. **Streaming**: User sends a prompt. The processor listens for high-frequency `chunk` messages from the worker.
3. **Synthesis**: Accumulates chunks and triggers `onChunk` callbacks to the React UI for real-time streaming.

## 6. Code Structure
- **init**: Handshake for model loading.
- **process**: The primary streaming orchestrator.

## 7. Points To Consider
- **Streaming Invariant**: Uses a callback-per-chunk model instead of a single result promise to ensure the UI feels alive during generation.
- **Resource Depth**: Quantized models are used to ensure the ~3GB LLM can run in browser VRAM alongside image models.
