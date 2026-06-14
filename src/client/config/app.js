/**
 * Image Boss - App Configuration
 */
import { SERVICES } from './services.js';

export const APP_CONFIG = {
  name: 'Image Boss',
  version: '1.0.0',
  maxFileSize: 5 * 1024 * 1024, // 5MB limit
  maxBatchItems: 12, // Each item holds a full-res canvas; cap to bound RAM usage
};

export const OPERATION_MODE = {
  SINGLE: 'single',
  BATCH: 'batch',
  WORKFLOW: 'workflow',
};

// Order of services in the nav — derived from the SERVICES object so there's
// a single source of truth (the key order in services.js defines nav order).
// To reorder, move the entry in services.js — no need to keep two lists in sync.
export const SERVICE_ORDER = Object.keys(SERVICES);
