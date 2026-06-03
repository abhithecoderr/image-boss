/**
 * Image Boss - Controls Configuration
 * Defines UI controls (sliders, selects, etc.) for each service
 */

import { SEGMENTATION_MODELS } from './models';

export const CONTROLS_CONFIG = {

  'background-removal': [
    {
      id: 'model',
      label: 'RMBG Model',
      type: 'select',
      defaultValue: 'birefnet-lite',
      options: [
        { value: 'birefnet', label: 'RMBG Pro (BiRefNet)' },
        { value: 'birefnet-lite', label: 'RMBG Lite (BiRefNet Lite)' }
      ]

    },
    { id: 'edgeShift', label: 'Edge Shift', type: 'range', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'edgeSmoothness', label: 'Edge Smoothness', type: 'range', min: 0, max: 20, step: 1, defaultValue: 0 },
    { id: 'edgeContrast', label: 'Edge Contrast', type: 'range', min: 0, max: 20, step: 1, defaultValue: 0 }
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
      defaultValue: SEGMENTATION_MODELS.sam2_1_tiny.model_id,
      options: [
        { value: SEGMENTATION_MODELS.sam2_1_tiny.model_id, label: 'SAM 2.1 Hiera Tiny (Fastest)' },
        { value: SEGMENTATION_MODELS.sam2_1_small.model_id, label: 'SAM 2.1 Hiera Small (Balanced)' },
        { value: SEGMENTATION_MODELS.sam2_1_large.model_id, label: 'SAM 2.1 Hiera Large (Best Quality)' }
      ]
    },
    {
      id: 'pointLabel',
      label: 'Point Type',
      type: 'select',
      defaultValue: 1,
      options: [
        { value: 1, label: '🟢 Positive (Keep)' },
        { value: 0, label: '🔴 Negative (Remove)' }
      ]
    }
  ],

  'upscaling': [
    {
      id: 'modelId',
      label: 'Upscale Model',
      type: 'select',
      defaultValue: 'esrgan',
      options: [
        { value: 'esrgan', label: 'Real-ESRGAN (General 4x)' },
        { value: 'esrgan_pro', label: 'ESRGAN Pro (General 4x)' },
        { value: 'esrgan_ultra', label: 'ESRGAN Ultra (General 4x)' },
        { value: 'bsrgan_x4', label: 'BSRGAN (Detail 4x)' },
        { value: 'bsrgan_x2', label: 'BSRGAN (Detail 2x)' },
        { value: 'real_esr_anime_x4', label: 'Real-ESRGAN (Anime 4x)' }
      ]
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
      id: 'quality',
      label: 'Compression Quality',
      type: 'range',
      min: 10,
      max: 100,
      step: 1,
      defaultValue: 80
    }
  ],
  'file-conversion': [
    {
      id: 'inputFormat',
      label: 'Input Format',
      type: 'select',
      disabled: true,
      options: [
        { value: 'image/png', label: 'PNG' },
        { value: 'image/jpeg', label: 'JPEG' },
        { value: 'image/webp', label: 'WebP' },
        { value: 'image/avif', label: 'AVIF' },
        { value: 'image/bmp', label: 'BMP' },
        { value: 'image/gif', label: 'GIF' },
        { value: 'image/tiff', label: 'TIFF' },
        { value: 'image/x-icon', label: 'ICO' },
        { value: 'image/x-portable-anymap', label: 'PBM' },
        { value: 'application/octet-stream', label: 'Unknown/Other' }
      ]
    },
    {
      id: 'format',
      label: 'Target Format',
      type: 'select',
      defaultValue: 'image/png',
      options: [
        { value: 'image/png', label: 'PNG' },
        { value: 'image/jpeg', label: 'JPEG' },
        { value: 'image/webp', label: 'WebP' },
        { value: 'image/avif', label: 'AVIF' },
        { value: 'image/bmp', label: 'BMP' },
        { value: 'image/gif', label: 'GIF' },
        { value: 'image/tiff', label: 'TIFF' },
        { value: 'image/x-icon', label: 'ICO' },
        { value: 'image/x-portable-anymap', label: 'PBM' }
      ]
    }
  ],
  'captioning': [
    {
      id: 'lfmPrompt',
      label: 'Prompt',
      type: 'text',
      defaultValue: 'Describe this image in detail.',
      placeholder: 'e.g. Describe this image in detail'
    }
  ],
  'line-art': [
    {
      id: 'method',
      label: 'Method',
      type: 'select',
      defaultValue: 'sobel',
      options: [
        { value: 'sobel', label: 'Classic (Sobel)' },
        { value: 'ai', label: 'AI Model (Informative)' }
      ]
    },
    {
      id: 'aiVariant',
      label: 'Model Variant',
      type: 'select',
      defaultValue: 'anime',
      options: [
        { value: 'anime', label: 'Anime' },
        { value: 'contour', label: 'Contour' }
      ],
      visibleIf: (settings) => settings.method === 'ai'
    },
    {
      id: 'details',
      label: 'Details',
      type: 'range',
      min: 0,
      max: 100,
      defaultValue: 75
    },
    {
      id: 'outputStyle',
      label: 'Output Style',
      type: 'select',
      defaultValue: 'natural',
      options: [
        { value: 'natural', label: 'Natural (Grayscale)' },
        { value: 'clean', label: 'Clean (B&W)' }
      ],
      visibleIf: (settings) => settings.method === 'ai'
    }
  ],
  'workflows': [], // Workflows handles its own custom control panel in the WorkflowBuilder
  'image-editor': [
    // --- Composition ---
    { id: 'aspectRatio', label: 'Aspect Ratio', type: 'select', category: 'composition', defaultValue: 'original', options: [
      { value: 'original', label: 'Original' },
      { value: 'free', label: 'Free' },
      { value: '1:1', label: '1:1 (Square)' },
      { value: '16:9', label: '16:9 (Wide)' },
      { value: '4:3', label: '4:3 (Standard)' },
      { value: '3:2', label: '3:2 (Classic)' },
      { value: '5:4', label: '5:4 (Portrait)' }
    ]},
    { id: 'rotation', label: 'Rotate', type: 'range', category: 'composition', min: 0, max: 270, step: 90, defaultValue: 0 },
    { id: 'flipX', label: 'Flip Horizontal', type: 'toggle', category: 'composition', defaultValue: false },
    { id: 'flipY', label: 'Flip Vertical', type: 'toggle', category: 'composition', defaultValue: false },
    
    // --- Light ---
    { id: 'exposure', label: 'Exposure', type: 'range', category: 'light', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'contrast', label: 'Contrast', type: 'range', category: 'light', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'highlights', label: 'Highlights', type: 'range', category: 'light', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'shadows', label: 'Shadows', type: 'range', category: 'light', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'whites', label: 'Whites', type: 'range', category: 'light', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'blacks', label: 'Blacks', type: 'range', category: 'light', min: -20, max: 20, step: 1, defaultValue: 0 },

    // --- Color ---
    { id: 'temperature', label: 'Temp', type: 'range', category: 'color', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'tint', label: 'Tint', type: 'range', category: 'color', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'saturation', label: 'Saturation', type: 'range', category: 'color', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'vibrance', label: 'Vibrance', type: 'range', category: 'color', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'hue', label: 'Hue', type: 'range', category: 'color', min: -180, max: 180, step: 1, defaultValue: 0 },

    // --- Effects ---
    { id: 'clarity', label: 'Clarity', type: 'range', category: 'effects', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'texture', label: 'Texture', type: 'range', category: 'effects', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'sharpening', label: 'Sharpening', type: 'range', category: 'effects', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'vignette', label: 'Vignette', type: 'range', category: 'effects', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'grain', label: 'Grain', type: 'range', category: 'effects', min: 0, max: 20, step: 1, defaultValue: 0 },
    { id: 'dehaze', label: 'Dehaze', type: 'range', category: 'effects', min: -20, max: 20, step: 1, defaultValue: 0 },
    { id: 'blur', label: 'Blur', type: 'range', category: 'effects', min: 0, max: 20, step: 1, defaultValue: 0 },

    // --- Filters ---
    { id: 'preset', label: 'Preset', type: 'select', category: 'filters', defaultValue: 'none', options: [
      { value: 'none', label: 'No Filter' },
      { value: 'auto', label: 'Auto Enhance' },
      { value: 'bw', label: 'Black & White' },
      { value: 'sepia', label: 'Sepia' },
      { value: 'vintage', label: 'Vintage' },
      { value: 'cinematic', label: 'Cinematic' },
      { value: 'modern', label: 'Modern' }
    ]},
    { id: 'intensity', label: 'Filter Intensity', type: 'range', category: 'filters', min: 0, max: 100, step: 1, defaultValue: 100 }
  ]
};
