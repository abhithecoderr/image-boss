/**
 * Predefined progress stages for consistent reporting across the pipeline.
 */
export const PROGRESS_STAGE = Object.freeze({
  DOWNLOADING: "downloading",   // Fetching model structure/weights
  INITIALIZING: "initializing", // Preparing devices, loading model to session
  PROCESSING: "processing",     // Model execution and canvas work
  SAVING: "saving",             // Post-processing, canvas conversions
  IDLE: "idle",                 // Completion / Reset
});
