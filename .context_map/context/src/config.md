# Context Map: config.js


## 1. Purpose

The central manifest and registry for the entire application. It defines the identity, hardware requirements (WebGPU/WASM), model paths, and UI configuration for every AI service. It acts as the "source of truth" that drives dynamic UI generation in the Sidebar and ControlPanel.


## 2. Imports

- **Non-Standard**: This is a static configuration module and does not contain external imports. It serves as a pure constant registry.


## 3. Dependencies

- **Used by**:
  - `AppContext.jsx` (For default service initialization).
  - `Sidebar.jsx` (For rendering the navigation list).
  - `ControlPanel.jsx` (For mapping service IDs to display labels and tools).
  - `useProcessor.js` (For retrieving model paths and hardware dtypes).


## 4. State Management

- **APP_CONFIG (Constant/Object)**:
  - Syntax: `export const APP_CONFIG = { name: 'Image Boss', version: '1.0.0' };`
  - Purpose: Stores top-level metadata for the application branding and versioning.

- **SERVICES (Constant/Object)**:
  - Syntax: `export const SERVICES = { ... };`
  - Purpose: The master dictionary of AI tools. Each key is a unique service ID containing model hashes, pipeline types (native/custom), and hardware targets (`dtype: 'fp16'`, `device: 'webgpu'`).

- **SERVICE_ORDER (Constant/Array)**:
  - Syntax: `export const SERVICE_ORDER = [ ... ];`
  - Purpose: Defines the sequential order of services as they should appear in the navigation sidebar.

- **OUTPUT_FORMATS (Constant/Array)**:
  - Syntax: `export const OUTPUT_FORMATS = [ ... ];`
  - Purpose: A registry of supported MIME types for the image conversion service.

- **COMPRESSION_PRESETS (Constant/Object)**:
  - Syntax: `export const COMPRESSION_PRESETS = { ... };`
  - Purpose: Maps semantic quality labels (light, medium, heavy) to technical quality floats and file size targets.


## 5. Project Flow

1. **Bootstrap**: Upon application load, `main.jsx` and `AppContext.jsx` import the registries.

2. **UI Generation**: The `Sidebar` iterates over `SERVICE_ORDER` to build the navigation links.

3. **Runtime Configuration**: When a service is selected, the application looks up the `SERVICES` object to determine if a Worker is needed and which model to fetch.

4. **Hardware Selection**: AI Processors query the `dtype` and `device` fields to initialize the WebGPU or WASM inference session correctly.


## 6. Code Structure

- **APP_CONFIG (Export)**:
  - Syntax: `export const APP_CONFIG = { ... };`
  - Purpose: Branding metadata.
  - Working: Static object holding the app name and version string.

- **SERVICES (Export)**:
  - Syntax: `export const SERVICES = { ... };`
  - Purpose: The primary data structure for the app's capability mapping.
  - Working: Organizes services into a flat map where each entry specifies technical requirements like `pipeline`, `usesWorker`, and `warmup` status. This structure allows new services to be added without changing the core React logic.

- **SERVICE_ORDER (Export)**:
  - Syntax: `export const SERVICE_ORDER = [ ... ];`
  - Purpose: UI layout management.
  - Working: A simple array of strings used as keys to iterate over the `SERVICES` object in a specific visual sequence.

- **OUTPUT_FORMATS (Export)**:
  - Syntax: `export const OUTPUT_FORMATS = [ ... ];`
  - Purpose: Format support registry.
  - Working: Maps human-readable labels to browser-native MIME types for usage in `<select>` elements.

- **COMPRESSION_PRESETS (Export)**:
  - Syntax: `export const COMPRESSION_PRESETS = { ... };`
  - Purpose: Optimization parameter mapping.
  - Working: Provides the `browser-image-compression` library with target metrics based on user selection.


## 7. Points To Consider

- **The Pipeline Invariant**: The `pipeline` field ('native' vs 'custom') is critical. 'Native' services run on the main thread using Canvas/JS, while 'custom' services almost always require a dedicated `worker.js` and `processor.js`.

- **Warmup Control**: The `warmup` flag is provided to trigger shader compilation during model load. This is essential for WebGPU models to prevent the "First-Run Freeze."

- **Device/Dtype Coupling**: Models listed with `device: 'webgpu'` should ideally use `dtype: 'fp16'` for performance, unless the model architecture explicitly requires `fp32` for precision.
