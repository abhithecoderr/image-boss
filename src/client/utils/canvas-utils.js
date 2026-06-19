
export async function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Handle Blob/File objects correctly
    const isBlob = source instanceof Blob || source instanceof File;
    const src = isBlob ? URL.createObjectURL(source) : source;

    img.onload = () => {
      if (isBlob) URL.revokeObjectURL(src); // Clean up memory
      resolve(img);
    };
    img.onerror = (e) => {
      if (isBlob) URL.revokeObjectURL(src);
      reject(new Error('Failed to load image. Source may be corrupt.'));
    };

    img.src = src;
  });
}


/**
 * Calculate filename and mime-type for a canvas result
 */
export const getDownloadMetadata = (canvas, originalFile, serviceId, settings = {}) => {
  const baseName = originalFile ? originalFile.name.replace(/\.[^/.]+$/, '') : `result_${Date.now()}`;

  if (serviceId === 'captioning') {
    return {
      filename: `${baseName}_caption.txt`,
      mimeType: 'text/plain'
    };
  }

  if (!originalFile) return { filename: `${baseName}.png`, mimeType: 'image/png' };

  let mimeType = originalFile.type || 'image/png';

  if (canvas?._resultMimeType) {
    mimeType = canvas._resultMimeType;
  } else if (canvas?._compressedMimeType) {
    mimeType = canvas._compressedMimeType;
  } else if (canvas?.dataset?.format) {
    mimeType = canvas.dataset.format;
  } else if (serviceId === 'background-removal') {
    mimeType = 'image/png';
  } else if (serviceId === 'file-conversion') {
    mimeType = settings['file-conversion']?.format || 'image/png';
  }

  const mimeMap = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/avif': 'avif', 'image/bmp': 'bmp', 'image/gif': 'gif',
    'image/tiff': 'tiff', 'image/x-icon': 'ico', 'image/x-portable-anymap': 'pbm',
    'application/pdf': 'pdf', 'text/plain': 'txt'
  };

  const extension = mimeMap[mimeType] || mimeType.split('/')[1] || 'png';

  return {
    filename: `${baseName}_${serviceId}.${extension}`,
    mimeType
  };
};

/**
 * Create a canvas from an image
 */
export function imageToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx };
}

/**
 * Resize a canvas while maintaining aspect ratio
 */
export function resizeCanvas(sourceCanvas, maxDimension = 2048) {
  const { width, height } = sourceCanvas;
  if (width <= maxDimension && height <= maxDimension) return sourceCanvas;

  const scale = maxDimension / Math.max(width, height);
  const newWidth = Math.floor(width * scale);
  const newHeight = Math.floor(height * scale);

  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = newWidth;
  resizedCanvas.height = newHeight;
  const ctx = resizedCanvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);

  return resizedCanvas;
}


/**
 * Convert canvas to blob
 */
export async function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise(resolve => {
    canvas.toBlob(resolve, type, quality);
  });
}

/**
 * Download a canvas as an image file.
 * If the canvas has a pre-compressed blob attached (e.g. from the compression service),
 * that blob is used directly to avoid re-encoding which would undo all compression work.
 */
export async function downloadCanvas(canvas, filename = 'image.png', type = 'image/png') {
  let blob;
  if (type === 'text/plain' || filename.endsWith('.txt')) {
    const captionText = canvas?.dataset?.caption || '';
    blob = new Blob([captionText], { type: 'text/plain;charset=utf-8' });
  } else {
    // Use the pre-encoded blob if available (avoids unnecessary re-encoding)
    blob = canvas._resultBlob || canvas._compressedBlob || await canvasToBlob(canvas, type);
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Standardized transparency detector using single-pixel context sampling.
 */
export function hasAlphaTransparency(canvas) {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    // Samples 1x1 corner pixel - if alpha is less than 255, we have transparency
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    return pixel[3] < 255;
  } catch (_) {
    return false;
  }
}


/**
 * Generate a thumbnail data URL from a canvas for queue previews.
 */
export function canvasToThumbURL(canvas, size = 56) {
  if (!canvas) return null;
  const thumb = document.createElement('canvas');
  thumb.width = size;
  thumb.height = size;
  const ctx = thumb.getContext('2d');

  // Fit the image within the square
  const scale = Math.min(size / canvas.width, size / canvas.height);
  const w = canvas.width * scale;
  const h = canvas.height * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;

  ctx.drawImage(canvas, x, y, w, h);
  return thumb.toDataURL('image/jpeg', 0.6);
}

/**
 * Format file size to human readable (consolidated from ui-utils.js)
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Pure utility functions for workflow step management (consolidated from workflow-utils.js)
 */
export function createStepId() {
  return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createStep(serviceId, options) {
  return { id: createStepId(), serviceId, options };
}

export function removeStep(steps, id) {
  return steps.filter((step) => step.id !== id);
}

export function updateStepOptions(steps, id, options) {
  return steps.map((step) =>
    step.id === id ? { ...step, options } : step
  );
}

export function reorderSteps(steps, startIndex, endIndex) {
  const result = Array.from(steps);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

/**
 * Cross-runtime canvas creation helper (safe in Web Workers and Main thread)
 */
export function createCanvas(width, height) {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return new OffscreenCanvas(width, height);
}

/**
 * Global singleton canvas registry that manages reusable, sized canvas buffers.
 * Solves duplicate boilerplate code and automates GPU memory cleanup.
 */
class CanvasCache {
  constructor() {
    this.cache = new Map();
  }

  get(key, width, height, ctxOptions = {}) {
    let entry = this.cache.get(key);
    if (!entry || entry.canvas.width !== width || entry.canvas.height !== height) {
      const canvas = createCanvas(width, height);
      entry = {
        canvas,
        ctx: canvas.getContext('2d', ctxOptions),
      };
      this.cache.set(key, entry);
    }
    return entry;
  }

  clear() {
    this.cache.clear();
  }
}

export const canvasCache = new CanvasCache();

