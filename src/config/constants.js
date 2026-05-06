/**
 * Image Boss - Constants
 * Static data for formats, presets and other constants
 */

// Supported output formats for conversion
export const OUTPUT_FORMATS = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/avif', label: 'AVIF' },
  { value: 'image/bmp', label: 'BMP' },
  { value: 'image/gif', label: 'GIF' },
  { value: 'image/tiff', label: 'TIFF' },
  { value: 'image/x-icon', label: 'ICO' },
  { value: 'image/x-portable-anymap', label: 'PBM' }
];

// Compression presets
export const COMPRESSION_PRESETS = {
  light: { maxSizeMB: 2, quality: 0.9 },
  medium: { maxSizeMB: 1, quality: 0.8 },
  heavy: { maxSizeMB: 0.5, quality: 0.7 },
};
