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
    description: 'AI-powered image descriptions',
    model: 'onnx-community/Florence-2-base-ft',
    pipeline: 'custom',
    dtype: 'fp16',
    device: 'webgpu',
    usesWorker: true,
    warmup: false,
    models: [
      { id: 'onnx-community/Florence-2-base-ft', name: 'Florence-2 Base', arch: 'florence2' },
      { id: 'LiquidAI/LFM2.5-VL-450M-ONNX', name: 'LFM 2.5 VL 450M', arch: 'lfm' }
    ],
    tasks: [
      { id: '<CAPTION>', name: 'Short Caption' },
      { id: '<DETAILED_CAPTION>', name: 'Detailed Caption' },
      { id: '<MORE_DETAILED_CAPTION>', name: 'Very Detailed' }
    ]
  },

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
// Controls Configuration - defines UI for each service
export const CONTROLS_CONFIG = {
  'background-removal': [
    {
      id: 'model',
      label: 'RMBG Model',
      type: 'select',
      defaultValue: 'inspyrenet',
      options: [
        { value: 'modnet', label: 'RMBG Fast (MODNet)' },
        { value: 'inspyrenet_lite', label: 'RMBG Lite (InSPyReNet Lite)' },
        { value: 'inspyrenet', label: 'RMBG Ultra (InSPyReNet)' },
        { value: 'birefnet', label: 'RMBG Pro (BiRefNet)' }
      ]
    },
    { id: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.05, defaultValue: 0.5 },
    { id: 'feathering', label: 'Feathering', type: 'range', min: 0, max: 20, step: 1, defaultValue: 0 }
  ],
  'magic-erase': [
    { id: 'radius', label: 'Brush Radius', type: 'range', min: 5, max: 100, step: 5, defaultValue: 20 },
    { id: 'strength', label: 'Strength', type: 'range', min: 0.1, max: 1.0, step: 0.1, defaultValue: 1.0 }
  ],
  'object-segmentation': [
    {
      id: 'modelId',
      label: 'SAM Model',
      type: 'select',
      defaultValue: 'Xenova/slimsam-77-uniform',
      options: [
        { value: 'Xenova/slimsam-77-uniform', label: 'SlimSAM (Fastest)' },
        { value: 'facebook/sam-vit-base', label: 'SAM ViT-Base (Balanced)' },
        { value: 'facebook/sam-vit-huge', label: 'SAM ViT-Huge (High Precision)' }
      ]
    }
  ],
  'upscaling': [
    {
      id: 'scale',
      label: 'Scale Factor',
      type: 'select',
      defaultValue: 2,
      options: [
        { value: 1.5, label: '1.5x (Super Turbo)' },
        { value: 2, label: '2x (Standard)' },
        { value: 3, label: '3x (High Detail)' },
        { value: 4, label: '4x (Ultra - Slow)' }
      ],
      parse: parseFloat
    },
    {
      id: 'detailsIntensity',
      label: 'Details',
      type: 'range',
      min: 0, max: 2, step: 0.1,
      defaultValue: 0.5
    },
    {
      id: 'brightness',
      label: 'Brightness',
      type: 'range',
      min: -0.3, max: 0.3, step: 0.05,
      defaultValue: 0
    }
  ],
  'blur': [
    {
      id: 'variant',
      label: 'YOLO Variant',
      type: 'select',
      defaultValue: 'nano',
      options: [
        { value: 'nano', label: 'Nano (Fastest)' },
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
        { value: 'xlarge', label: 'XLarge (Best)' }
      ]
    },
    {
      id: 'blurAmount',
      label: 'Blur Amount',
      type: 'range',
      min: 5, max: 80, step: 5,
      defaultValue: 20
    },
    {
      id: 'feathering',
      label: 'Edge Feathering',
      type: 'range',
      min: 0.1, max: 0.95, step: 0.05,
      defaultValue: 0.75
    }
  ],
  'compression': [
    {
      id: 'preset',
      label: 'Compression Level',
      type: 'select',
      defaultValue: 'medium',
      options: [
        { value: 'light', label: 'Light (High Quality)' },
        { value: 'medium', label: 'Medium (Balanced)' },
        { value: 'heavy', label: 'Heavy (Small File Size)' }
      ]
    }
  ],
  'file-conversion': [
    {
      id: 'format',
      label: 'Target Format',
      type: 'select',
      defaultValue: 'image/png',
      options: [
        { value: 'image/png', label: 'PNG' },
        { value: 'image/jpeg', label: 'JPEG' },
        { value: 'image/webp', label: 'WebP' }
      ]
    }
  ],
  'captioning': [
    {
      id: 'modelId',
      label: 'Caption Model',
      type: 'select',
      defaultValue: 'onnx-community/Florence-2-base-ft',
      options: [
        { value: 'onnx-community/Florence-2-base-ft', label: 'Florence-2 Base' },
        { value: 'LiquidAI/LFM2.5-VL-450M-ONNX', label: 'LFM 2.5 VL 450M' }
      ]
    },
    {
      id: 'task',
      label: 'Task Type',
      type: 'select',
      defaultValue: '<CAPTION>',
      options: [
        { value: '<CAPTION>', label: 'Short Caption' },
        { value: '<DETAILED_CAPTION>', label: 'Detailed Caption' },
        { value: '<MORE_DETAILED_CAPTION>', label: 'Very Detailed' },
        { value: '<REFERRING_EXPRESSION_SEGMENTATION>', label: 'Object Segmentation' }
      ],
      visibleIf: (settings) => !settings.modelId || !settings.modelId.includes('LFM')
    },
    {
      id: 'segPrompt',
      label: 'Object to Segment',
      type: 'text',
      defaultValue: '',
      placeholder: "e.g. the person's hat",
      visibleIf: (settings) => settings.task === '<REFERRING_EXPRESSION_SEGMENTATION>' && (!settings.modelId || !settings.modelId.includes('LFM'))
    },
    {
      id: 'lfmPrompt',
      label: 'Prompt (optional)',
      type: 'text',
      defaultValue: '',
      placeholder: 'e.g. Describe this image in detail',
      visibleIf: (settings) => settings.modelId?.includes('LFM')
    }
  ]
};
