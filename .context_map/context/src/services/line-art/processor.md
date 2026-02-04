# Context Map: line-art/processor.js

## 1. Purpose
Visual filter for extracting edges from images to create "Line Art." Orchestrates the CPU-based Sobel convolution pass defined in core utilities.

## 2. Imports
- **../../core/canvas-utils.js**: `applySobelFilter` - The core convolution algorithm.

## 3. Dependencies
- **Uses**:
  - [canvas-utils.js](file:///c:/projects/bg/my-ai-app/src/core/canvas-utils.js)
- **Used by**:
  - `main.js`: Main UI orchestrator.

## 4. State Management
(Empty - Stateless utility service)

## 5. Project Flow
1. **Intake**: Receives the source canvas and a sensitivity threshold.
2. **Buffer Preparation**: Clones the source canvas to avoid mutating the original workspace view.
3. **Execution**: Invokes the `applySobelFilter`.
4. **Return**: Delivers the black-and-white line art result.

## 6. Code Structure

- **`process` (Function)**
  - **Name (Type)**: process (Primary Entry Point)
  - **Syntax**: `export async function process(sourceCanvas, options, onProgress)`
  - **Working**: Routes the request to the shared `applySobelFilter` utility.

## 7. Points To Consider
- **Main Thread Latency**: Consider that the Sobel filter (L32) uses pixel-wise CPU loops; for 4K+ images, notice that this may cause temporary UI freezes and is a candidate for worker migration.
