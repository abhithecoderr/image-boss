/**
 * Image Boss - App Configuration
 */

export const APP_CONFIG = {
  name: 'Image Boss',
  version: '1.0.0',
  maxFileSize: 5 * 1024 * 1024, // 5MB limit
};

export const OPERATION_MODE = {
  SINGLE: 'single',
  BATCH: 'batch',
  WORKFLOW: 'workflow',
};

// Order of services in the nav
export const SERVICE_ORDER = [
  'background-removal',
  'magic-erase',
  'object-segmentation',
  'upscaling',
  'blur',
  'line-art',
  'compression',
  'file-conversion',
  'captioning',
  'image-editor',
  'workflows',
];
