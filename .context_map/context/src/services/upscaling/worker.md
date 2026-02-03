# Context Map: upscaling/worker.js

## Purpose
Background thread execution for high-fidelity image upscaling using Real-ESRGAN. Implements a sophisticated tile-based inference engine to bypass GPU memory limits, a "Turbo" downscaling optimization for fractional scales, and frequency-separation filtering for surgical detail restoration.

## Imports
- **onnxruntime-web/webgpu**: Direct ONNX execution engine (L8).

## Dependencies
- **Used by**: `processor.js` (IPC)
- **Uses**:
  - `TheGuy444/Real-ESRGAN-ONNX` (Model + Data)
  - WebGPU/WASM runtime (via ONNX Runtime)

## Project Flow Connection
- **Session Management**: `getSession` (L66-106) lazily loads the split `.onnx` and `.data` files with fetch-progress tracking.
- **Input Strategy**: Calculates `inputFactor` (L129) to decide if "Turbo" mode (pre-downscaling) should be used for sub-4x requests.
- **Tiling Loop**: Iterates over 128x128 tiles with overlap/stride logic (L161-239) to prevent edge artifacts.
- **Post-Processing**: `Frequency Separation` (L245-296) and color grading (L299-326) execute on the upscaled buffer before returning.

## File Code Structure

**`fetchWithProgress(url, label, ...)`** (L33-64): Custom XHR-like wrapper for `fetch` to provide granular model download updates.

**`getSession(onProgress)`** (L66-106): Detects WebGPU and falls back to WASM if shader initialization fails (L86-96).

**`self.onmessage` handler** (L108-366):
- **Turbo Optimization** (L131-149): Resizes input if `targetScale < 4` to drastically improve performance while still benefiting from 4x geometry.
- **Tile Stitching Loop** (L171-239):
  - **Edge Clamping** (L181-191): Ensures tiles at borders don't read out-of-bounds pixels.
  - **Tensor Format** (L195-200): Converts [RGB] to NCHW [1, 3, 128, 128] normalized floats.
  - **Inference & Stitch** (L204-231): Runs `sess.run` and draws the results into `outputCanvas`.
- **Frequency Separation** (L245-296): Extracts high-frequency details from the original (L285) and injects them into the AI result to fix plastic-skin artifacts.
- **Color Grading** (L299-326): Applies brightness and HSL saturation adjustments.

## Code Details

**`while loop` for `tiling`** (L171-239): Complex orchestration loop. Coordinates nested `for (x)` and `for (y)` passes to execute Real-ESRGAN inference on overlapping 128x128 pixel patches.

**`const inputFactor = targetScale / 4`** (L129): "Turbo" mode logic. If enabled, it resizes the input so the 4x model architecture yields the requested fractional scale (e.g., 1.5x) in a single pass.

**`Frequency Separation` logic** (L245-296): Re-injects high-frequency details using `const detailImg = original - blur`. Blends via `composite_mode` to restore textures lost during AI reconstruction.
