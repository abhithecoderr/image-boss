/**
 * Image Boss - Service Definitions
 * Each service is self-contained with its model and pipeline configuration
 */

export const SERVICES = {
  'background-removal': {
    id: 'background-removal',
    name: 'Background Removal',
    icon: '✂️',
    description: 'Remove backgrounds with high-precision AI',
    model: 'OS-Software/InSPyReNet-SwinB-Plus-Ultra-ONNX',
    pipeline: 'custom',
    dtype: 'fp16',
    device: 'webgpu',
    usesWorker: true,
    warmup: false,
  },
  'magic-erase': {
    id: 'magic-erase',
    name: 'Magic Erase',
    icon: '🪄',
    description: 'Erase elements from an image using AI inpainting',
    model: 'TheGuy444/LaMa-Web', // Just placeholder as logic sits in custom worker
    pipeline: 'custom',
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
    model: 'x-Liola-x/informative-drawings-onnx',
    pipeline: 'custom',
    usesWorker: true,
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
    description: 'AI-powered image descriptions',
    model: 'LiquidAI/LFM2.5-VL-450M-ONNX',
    pipeline: 'custom',
    dtype: 'fp16',
    device: 'webgpu',
    usesWorker: true,
    warmup: false,
    models: [
      { id: 'LiquidAI/LFM2.5-VL-450M-ONNX', name: 'LFM 2.5 VL 450M', arch: 'lfm' }
    ]
  },
  'image-editor': {
    id: 'image-editor',
    name: 'General Editor',
    icon: '⚙️',
    description: 'Professional adjustments: Crop, Light, Color, Effects & Filters',
    pipeline: 'native',
    usesWorker: false,
    warmup: false,
  },
  'workflows': {
    id: 'workflows',
    name: 'Workflows',
    icon: '🗺️',
    description: 'Chain multiple AI services together',
    pipeline: 'native',
    usesWorker: true,
    warmup: false,
  }
};
