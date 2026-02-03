# Context Map: blur/worker.js

## Purpose
Background execution of YOLO26-pose for privacy-focused face blurring. Implements manual tensor parsing for surgical keypoint access, adaptive geometry calculation for blur radii, and localized patch-based image processing using `OffscreenCanvas`.

## Imports
- **@huggingface/transformers**: `AutoModel`, `AutoProcessor`, `RawImage`

## Dependencies
- **Used by**: `processor.js` (IPC)
- **Uses**:
  - `onnx-community/yolo26-pose-ONNX` family of models
  - Transformers.js runtime for WebGPU/WASM inference

## Project Flow Connection
- **Detection Phase**: `detectFaces` (L127-235) stretches images to 640x640 (preserving training aspect ratio), runs inference, and manually parses the 51-keypoint pose tensor (L170-228).
- **Surgical Geometry**: `applyBlur` (L275-393) calculates face-specific radii using eye distance (L311-315) or bounding box fallback.
- **Visual Modification**: Uses localized `OffscreenCanvas` patches (L338) and `radialGradients` (L375) for soft-feathered blurring.

## File Code Structure

**`MODEL_VARIANTS`** (L16-22): Maps string keys ('nano', 'xlarge') to Hugging Face model IDs.

**`initDetector(variant, onProgress)`** (L39-94): Handles dual-device loading (WebGPU/fp16 first, WASM/fp32 fallback).

**`detectFaces(imageData, width, height)`** (L127-235):
- **Stretched Preprocessing** (L131-152): Forces 640x640 resize without padding to match `YOLOSImageProcessor` signature.
- **Auto-Domain Detection** (L186-193): Identifies if coordinates are in pixel space [0, 640] or normalized [0, 1].
- **Box Format Detection** (L208-220): Switches between `[x1, y1, x2, y2]` and `[cx, cy, w, h]` based on geometric relations.
- **Keypoint Extraction** (L223-231): Offsets index by 6 if 57 channels (class ID present) vs 5 if 56 channels.

**`applyBlur(imageData, width, height, detections, blurAmount)`** (L275-393):
- **Face Strategy** (L291): Targeted indices 0-4 (Nose, Eyes, Ears) for high-precision masking.
- **Adaptive Radius** (L309-326): Scales blur radius based on inter-ocular distance with a 40% sanity cap.
- **Surgical Compositing** (L385-391): Uses `destination-in` composite mode to apply radial masks to blurred patches.

**`self.onmessage` handler** (L271-379): Routes type-based requests for `init`, `detect`, `blur`, and `dispose`.

## Code Details

- **detectFaces** (L124-241): Robust parser with auto-shape, auto-domain, and scientific box format inference. Uses `LOCAL_CONF_THRESHOLD = 0.2` and `iouThreshold = 0.75` for surgical crowd detection.
- **applyBlur** (L281-381): Supports user-adjustable `radiusScale`, `feathering`, and `shape`. Transitions from `arc()` to `ellipse()` (L367) for adjustable aspect ratios (tall ellipses).
- **IPC Support** (L394-527): Handles `blur` and `reblur` commands with the new `shape` parameter.

## Invariants & Hazards
- **Coordinate Domain Trap**: YOLO26 models can switch between Pixel (0-640) and Normalized (0-1) domains. The parser MUST perform an exhaustive signal check (L171-181) before processing.
- **Box Format Ambiguity**: `[x1, y1, x2, y2]` vs `[cx, cy, w, h]` detection is based on the heuristic that in corner format, `v2 > v0` and `v3 > v1` (L204).
- **Patch Distortion**: Elliptical masks require larger patch heights (`ph`) to avoid clipping. The implementation (L339-342) scales `ph` by the `shape` factor.
