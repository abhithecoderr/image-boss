# Context Map: config.js

## Purpose
Central configuration hub for Image Boss. Defines global application settings, service availability, model aliases, and shared constants for UI-driven workflows.

## Imports
- No external imports (pure data export file)

## Dependencies
- **Used by**:
  - `main.js`: Core orchestration logic and UI rendering
  - All service processors: For looking up model names and hardware preferences
- **Uses**: None

## Project Flow Connection
- **Static Ground Truth**: Provides the data structure used to generate the main navigation.
- **Service Registration**: Each key in `SERVICES` represents a feature available in the app.
- **Warmup Management**: Includes flags for pre-loading models.

## File Code Structure

**`APP_CONFIG`** (L6-9): Basic application metadata (name, version).

**`SERVICES`** (L12-124): Exhaustive map of all available tools.
- Each service includes `id`, `name`, `icon`, `description`, `model`, `pipeline`, `dtype`, `device`, `usesWorker`, and `warmup`.

**`SERVICE_ORDER`** (L127-137): Array defining the sequence of services in the sidebar.

**`OUTPUT_FORMATS`** (L140-144): Standard export options for file conversion.

**`COMPRESSION_PRESETS`** (L147-151): Quality/Size profiles for the compression service.

## Code Details

**`const SERVICES` object** (L12-124): Primary registry where each key maps to a service configuration. Entries include `dtype: 'fp32'` (full precision) or `q8` (quantized) and `device: 'webgpu'` hardware preferences for `Transformers.js` / `ONNX` loaders.

**`const SERVICE_ORDER` array** (L127-137): Array of strings that determines the layout order of service cards in the `main.js` UI generator.

**`const COMPRESSION_PRESETS` object** (L147-151): Configuration profiles for the `compression/processor.js`. Maps names like `light` to a `{ maxSizeMB, quality }` parameter set.
