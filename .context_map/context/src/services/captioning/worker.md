# Context Map: captioning/worker.js


## 1. Purpose

The deep-learning inference thread for image captioning. It runs the Microsoft Florence-2 model via Transformers.js, managing multi-gigabyte weight loading, auto-processor tokenization, and structured vision-task execution.


## 2. Imports

- **Transformers.js**:
  - Syntax: `import { Florence2ForConditionalGeneration, AutoProcessor, RawImage, env } from '@huggingface/transformers';`
  - Purpose: Core AI framework for local Florence-2 execution.


## 3. Dependencies

- **Used by**:
  - `processor.js` (Main thread communicator).

- **External APIs**:
  - **WebGPU**: Primary hardware target.
  - **OffscreenCanvas**: Bridge between `ImageBitmap` and the Transformers.js `RawImage` format.


## 4. State Management

- **model / processor (Variables)**:
  - Syntax: `let model = null; let processor = null;`
  - Purpose: Cached AI instances to prevent subsequent prompt latency.

- **cachedCanvas (Variable)**:
  - Syntax: `let cachedCanvas = null;`
  - Purpose: Reusable buffer for bitmap-to-tensor conversion.


### 1. Initialization
- **Flow**: Loads the Florence-2 `AutoProcessor` and `Florence2ForConditionalGeneration` weights.
- **Files Involved**:
  - `@huggingface/transformers`: Downloads and initializes the large-scale vision-language model weights and processor.

### 2. HW-Specific Loading
- **Flow**: Loads the model with `dtype: 'fp32'` directly for WebGPU to ensure maximum precision and avoid first-run fallback lag.

### 3. Input Preparation
- **Flow**: Converts the incoming bitmap to a `RawImage` and constructs the Florence-2 specific task prompts (e.g., `<CAPTION>` or `<REFERRING_EXPRESSION_SEGMENTATION>{prompt}`).

### 4. Generation
- **Flow**: Runs the auto-regressive model to generate text tokens.
- **Files Involved**:
  - `@huggingface/transformers`: Executes the Beam Search or Greed Search token generation loop.

### 5. Decoding
- **Flow**: Converts tokens back into human-readable strings and removes special punctuation tags.
- **Files Involved**:
  - `@huggingface/transformers`: Utilizes the model tokenizer to convert high-dimensional vectors back to text.


## 6. Code Structure

- **bitmapToCanvas (Function)**:
  - Syntax: `function bitmapToCanvas(bitmap) { ... }`
  - Purpose: Format bridge.
  - Working: Ensures incoming `ImageBitmap` (Transferable) is converted to an `OffscreenCanvas` so it can be ingested by the `RawImage.fromCanvas` utility.

- **onmessage (Handler)**:
  - Syntax: `self.onmessage = async ({ data }) => { ... };`
  - Purpose: Global message router.
  - Working: Governs the Florence-2 lifecycle. It includes a robust error mapper that detects numeric hardware codes and translates them into user-friendly "OOM or WebGPU incompatibility" messages.


## 7. Points To Consider

- **The Florence Task Registry**: Tasks like `<REFERRING_EXPRESSION_SEGMENTATION>` return location tokens. The worker sanitizes these by removing underscores (`<loc_123>` -> `<loc123>`) to ensure compatibility with the processor's parser.

- **V3 Prompt Invariant**: Transformers.js v3 requires a space between the task tag and the prompt text (e.g., `<TASK> prompt`). The worker enforces this formatting to prevent empty model outputs.

- **Token Limit Invariant**: `max_new_tokens: 100` is default for captions. For `<REFERRING_EXPRESSION_SEGMENTATION>`, this is increased to `1024` to prevent coordinate truncation in complex polygons. This keeps response time under 2-5 seconds depending on polygon complexity.

- **Strict Proxy-Disable**: `env.backends.onnx.wasm.proxy = false` is set to ensure the worker communicates directly with the WASM binary, avoiding double-proxy overhead in modern browsers.
