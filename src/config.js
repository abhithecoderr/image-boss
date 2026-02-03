/**
 * Image Boss - Configuration
 * Central configuration for all services and models
 */

export const APP_CONFIG = {
  name: 'Image Boss',
  version: '1.0.0',
};

// Service definitions - each service is self-contained
export const SERVICES = {
  'background-removal': {
    id: 'background-removal',
    name: 'Background Removal',
    icon: '✂️',
    description: 'Remove backgrounds with AI precision',
    model: 'onnx-community/BiRefNet_lite',
    pipeline: 'custom',
    dtype: 'fp32',
    device: 'webgpu',
    usesWorker: true,
    warmup: false,
  },
  'object-segmentation': {
    id: 'object-segmentation',
    name: 'Object (Extract/Remove)',
    icon: '🎯',
    description: 'Extract objects or remove them with AI',
    model: 'Xenova/slimsam-77-uniform',
    pipeline: 'custom', // Uses SamModel low-level API
    dtype: 'fp16',
    device: 'webgpu',
    usesWorker: true,
    warmup: false,
  },
  'upscaling': {
    id: 'upscaling',
    name: 'Upscale',
    icon: '🔍',
    description: 'Enhance image resolution 2x',
    model: 'UpscalerJS',
    pipeline: 'native',
    usesWorker: true,
    warmup: false,
  },
  'blur': {
    id: 'blur',
    name: 'Face Blur',
    icon: '👤',
    description: 'Auto-blur faces for privacy (YOLO26)',
    model: 'onnx-community/yolo26n-ONNX',  // nano variant, can use s/m/l/x
    pipeline: 'custom',
    dtype: 'fp32',
    device: 'webgpu',
    usesWorker: true,
    warmup: false,
  },
  'line-art': {
    id: 'line-art',
    name: 'Line Art',
    icon: '✏️',
    description: 'Extract line art from images',
    model: null, // WebGL Sobel
    pipeline: 'native',
    usesWorker: false,
    warmup: false,
  },
  'compression': {
    id: 'compression',
    name: 'Compress',
    icon: '📦',
    description: 'Reduce file size smartly',
    model: null, // browser-image-compression
    pipeline: 'native',
    usesWorker: true,
    warmup: false,
  },
  'style-transfer': {
    id: 'style-transfer',
    name: 'Style Transfer',
    icon: '🎨',
    description: 'Coming Soon - Apply artistic styles',
    model: null, // Currently unavailable in transformers.js
    pipeline: 'disabled',
    disabled: true,
    usesWorker: false,
    warmup: false,
  },
  'file-conversion': {
    id: 'file-conversion',
    name: 'Convert',
    icon: '🔄',
    description: 'Convert between formats',
    model: null, // OffscreenCanvas
    pipeline: 'native',
    usesWorker: false,
    warmup: false,
  },
  'captioning': {
    id: 'captioning',
    name: 'Caption',
    icon: '💬',
    description: 'Detailed image descriptions (Florence-2)',
    model: 'onnx-community/Florence-2-base-ft',
    pipeline: 'custom',
    dtype: 'fp16',
    device: 'webgpu',
    usesWorker: true,
    warmup: false,
    tasks: [
      { id: '<CAPTION>', name: 'Short Caption' },
      { id: '<DETAILED_CAPTION>', name: 'Detailed Caption' },
      { id: '<MORE_DETAILED_CAPTION>', name: 'Very Detailed' }
    ]
  },
  'chat': {
    id: 'chat',
    name: 'AI Chat',
    icon: '💭',
    description: 'Chat with local AI (Liquid LFM 1.2B)',
    model: 'LiquidAI/LFM2.5-1.2B-Base-ONNX',
    pipeline: 'custom',
    dtype: 'q4',
    device: 'webgpu',
    usesWorker: true,
    warmup: false,
  },
};

// Order of services in the nav
export const SERVICE_ORDER = [
  'background-removal',
  'object-segmentation',
  'upscaling',
  'blur',
  'line-art',
  'compression',
  'style-transfer',
  'file-conversion',
  'captioning',
];

// Supported output formats for conversion
export const OUTPUT_FORMATS = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
];

// Compression presets
export const COMPRESSION_PRESETS = {
  light: { maxSizeMB: 2, quality: 0.9 },
  medium: { maxSizeMB: 1, quality: 0.8 },
  heavy: { maxSizeMB: 0.5, quality: 0.7 },
};
