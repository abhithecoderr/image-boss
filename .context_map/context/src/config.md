# Context Map: config.js

## 1. Purpose
Central configuration for and service registry for Image Boss. Defines model identifiers, pipeline types, hardware preferences, and UI ordering for all AI tools. Acts as the "Brain" of the application's service architecture.

## 2. Imports
- No external imports (Static data export).

## 3. Dependencies
- **Uses**:
  - Hugging Face Hub (Reference IDs).
- **Used by**:
  - `main.js`: Primary consumer for dynamic service loading and UI generation.

## 4. State Management
(Empty - Static configuration module)

## 5. Project Flow
1. **Declaration Stage**: Exports immutable configuration objects during the application's bootstrap phase.
2. **UI Mapping**: `main.js` iterates through `SERVICE_ORDER` to build the navigation sidebar.
3. **Execution Routing**: When a service is selected, `main.js` looks up the `model` and `pipeline` type in `SERVICES` to decide which processor and weights to initialize.

## 6. Code Structure

- **`APP_CONFIG` (Object)**
  - **Name (Type)**: APP_CONFIG (Constant)
  - **Syntax**: `export const APP_CONFIG = { ... }`
  - **Purpose**: General metadata for the application (name, version).

- **`SERVICES` (Object)**
  - **Name (Type)**: SERVICES (Registry)
  - **Syntax**: `export const SERVICES = { ... }`
  - **Purpose**: Orchestration registry for all AI tools.
  - **Working**: Defines the complete metadata for each tool:
    - `id`: Unique identifier used for routing.
    - `model`: Repository ID or library name.
    - `pipeline`: 'custom', 'native', or 'disabled' execution strategy.
    - `dtype`: precision preference ('fp16', 'fp32', 'q4').
    - `device`: Hardware target ('webgpu').
    - `usesWorker`: Boolean flag for thread isolation.

- **`SERVICE_ORDER` (Array)**
  - **Name (Type)**: SERVICE_ORDER (Array/String)
  - **Syntax**: `export const SERVICE_ORDER = [ ... ]`
  - **Purpose**: Controls the sequence of appearance in the UI navigation bar.

- **`OUTPUT_FORMATS` (Array)**
  - **Name (Type)**: OUTPUT_FORMATS (Array/Object)
  - **Syntax**: `export const OUTPUT_FORMATS = [ ... ]`
  - **Purpose**: Registry of supported image export types (MIME types).

- **`COMPRESSION_PRESETS` (Object)**
  - **Name (Type)**: COMPRESSION_PRESETS (Object)
  - **Syntax**: `export const COMPRESSION_PRESETS = { ... }`
  - **Purpose**: Quality vs Size settings for the compression service.

## 7. Points To Consider
- **Model Registry Sync**: Note that Hugging Face IDs in `SERVICES` (L36) must remain accurate to prevent loading errors; consider verifying these after any model hub maintenance.
- **Pipeline Strategy**: Consider that `pipeline: 'custom'` services (L37) require manual tensor mapping in their processors, unlike 'native' or 'disabled' ones.
- **UI Blocking**: Note that if `usesWorker` is false (L40), the operation must be extremely lightweight to avoid freezing the browser interface.
