# Context Map: blur/worker.js


## 1. Purpose

The specialized AI thread for Face and Person detection. It runs the YOLO26-Pose model via ONNX Runtime Web, performs bit-precise tensor parsing to extract facial keypoints (eyes, nose), and implements elliptical surgical blurring with feathering support.


## 2. Imports

- **onnxruntime-web**:
  - Syntax: `import * as ort from 'onnxruntime-web/webgpu';`
  - Purpose: High-performance model runner with WebGPU-first execution engine.


## 3. Dependencies

- **Used by**:
  - `processor.js` (The main-thread communicator).

- **External APIs**:
  - **WebGPU**: Primary acceleration API.
  - **OffscreenCanvas**: Used for image preprocessing and result compositing inside the worker thread.
  - **fetch**: Used for partitioned model downloading with progress tracking.


## 4. State Management

- **session (Variable)**:
  - Syntax: `let session = null;`
  - Purpose: The active ONNX Inference Session.

- **workerBlurCanvas (Variable)**:
  - Syntax: `let workerBlurCanvas = null;`
  - Purpose: Reused buffer for applying blur filters to subject masks.


### 1. Intake
- **Flow**: Downloads the ONNX weights from HuggingFace with custom progress monitoring.

### 2. Preprocessing
- **Flow**: Stretches the incoming bitmap to a fixed 640x640 RGB tensor (YOLO spec).

### 3. Inference
- **Flow**: Runs the pose model.
- **Files Involved**:
  - `onnxruntime-web`: Core engine for executing the YOLO-pose ONNX graph.

### 4. Parsing
- **Flow**: Implements a "Scientific Box Format Inference" to normalize the results.

### 5. NMS
- **Flow**: Performs Non-Maximum Suppression to remove overlapping detections.

### 6. Elliptical Rendering
- **Flow**: Uses keypoints (eyes/nose) to calculate the rotation and scale before applying the blur filter.
- **Files Involved**:
  - `processor.js`: Receives the resulting blurred Subject bitmap for UI update.


## 6. Code Structure

- **detectFaces (Function)**:
  - Syntax: `async function detectFaces(bitmap, width, height) { ... }`
  - Purpose: The core AI inference logic.
  - Working: Manages the canvas-to-tensor conversion, invokes the ORT session, and performs the manual multi-channel tensor crawl to extract both bounding boxes and 17-point keymaps.

- **applyBlur (Function)**:
  - Syntax: `async function applyBlur(bitmap, width, height, detections, options = {}) { ... }`
  - Purpose: The pixel manipulation engine.
  - Working: Resizes the `workerBlurCanvas` to match the source, renders the image, and then iterates through detections. It uses `canvas.clip()` with `ellipse()` to apply `blur(Npx)` filters exclusively to the detected faces.

- **nms (Function)**:
  - Syntax: `function nms(candidates, iouThreshold) { ... }`
  - Purpose: Subject de-duplication.
  - Working: Standard IOU-based suppression to ensure that a single face isn't blurred multiple times by overlapping model proposals.


## 7. Points To Consider

- **Scientific Box Format Invariant**: YOLO models can change coordinate domains (Pixel vs Normalized) based on version. The worker includes a heuristic check `isPixelSpace` to auto-detect this at runtime.

- **Keypoint Logic**: Face radius is calculated by measuring the Euclidean distance between Left Eye and Right Eye keypoints. This provides much more natural-looking blurs than simple box-based clipping.

- **WASM Fallback Trap**: While ORT is imported from the `webgpu` build, the worker uses standard fetch to bridge the model into WASM if WebGPU initialization fails (`navigator.gpu` check).

- **The Ellipse Radius Scale**: The `radiusScale` option (default 1.0) allows the user to expand the blur beyond the detected eye-distance, which is vital for covering large hair-styles or hats that the AI doesn't categorize as "face."
