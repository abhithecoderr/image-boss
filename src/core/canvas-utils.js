
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
 * Convert a File to a data URL
 */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
 * Convert canvas or image to ImageBitmap for zero-copy worker transfer
 */
export async function canvasToBitmap(source) {
  return await createImageBitmap(source);
}

/**
 * Apply a mask to an image (for background removal)
 * Returns a canvas with transparent background where mask is black
 */
export function applyMask(imageCanvas, maskData) {
  const { width, height } = imageCanvas;
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const ctx = resultCanvas.getContext('2d');

  // Draw original image
  ctx.drawImage(imageCanvas, 0, 0);

  // Get image data and apply mask
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < maskData.length; i++) {
    // Set alpha channel based on mask value
    data[i * 4 + 3] = maskData[i];
  }

  ctx.putImageData(imageData, 0, 0);
  return resultCanvas;
}

/**
 * Apply blur to specific regions of an image
 */
export function applyBlurToRegions(canvas, regions, blurAmount = 20) {
  const ctx = canvas.getContext('2d');
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');

  // Draw original
  tempCtx.drawImage(canvas, 0, 0);

  regions.forEach(region => {
    const { x, y, width, height } = region;

    // Save state
    ctx.save();

    // Clip to region
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    // Apply blur filter and redraw
    ctx.filter = `blur(${blurAmount}px)`;
    ctx.drawImage(canvas, 0, 0);

    // Restore
    ctx.restore();
  });

  return canvas;
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
  // Use the pre-encoded blob if available (avoids unnecessary re-encoding)
  const blob = canvas._resultBlob || canvas._compressedBlob || await canvasToBlob(canvas, type);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sobel edge detection for line art
 */
export function applySobelFilter(canvas, threshold = 50) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const output = ctx.createImageData(width, height);
  const out = output.data;

  // Convert to grayscale first
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kidx = (ky + 1) * 3 + (kx + 1);
          gx += gray[idx] * sobelX[kidx];
          gy += gray[idx] * sobelY[kidx];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const outIdx = (y * width + x) * 4;

      // Invert: edges are black, background is white
      const value = magnitude > threshold ? 0 : 255;
      out[outIdx] = value;
      out[outIdx + 1] = value;
      out[outIdx + 2] = value;
      out[outIdx + 3] = 255;
    }
  }

  ctx.putImageData(output, 0, 0);
  return canvas;
}

/**
 * Fast Surgical Inpaint
 * Performs repetitive edge-averaging diffusion to fill the masked area.
 */
export function surgicalInpaint(canvas, maskCanvas, iterations = 30) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const mCtx = maskCanvas.getContext('2d');
  const maskData = mCtx.getImageData(0, 0, width, height).data;

  // Determine a neutral initialization color from the boundary
  // Pulling from just outside the masked area
  let totalR = 0, totalG = 0, totalB = 0, edgeCount = 0;
  for (let i = 0; i < maskData.length; i += 40) { // Sample to save time
    if (maskData[i] < 50) { // Not masked
      // Check if it has a masked neighbor (meaning it's an edge)
      const hasMaskedNeighbor = (
        (i > 4 && maskData[i-4] > 128) ||
        (i < maskData.length - 4 && maskData[i+4] > 128) ||
        (i > width * 4 && maskData[i-width*4] > 128) ||
        (i < maskData.length - width * 4 && maskData[i+width*4] > 128)
      );

      if (hasMaskedNeighbor) {
        totalR += data[i];
        totalG += data[i+1];
        totalB += data[i+2];
        edgeCount++;
      }
    }
  }

  const avgR = edgeCount > 0 ? totalR / edgeCount : 128;
  const avgG = edgeCount > 0 ? totalG / edgeCount : 128;
  const avgB = edgeCount > 0 ? totalB / edgeCount : 128;

  // Create a working buffer to avoid feedback artifacts within a single pass
  let current = new Uint8ClampedArray(data);
  let next = new Uint8ClampedArray(data);

  // PRE-REMOVAL: Kill the object color inside the mask
  for (let i = 0; i < maskData.length; i += 4) {
    if (maskData[i] > 128) {
      current[i] = avgR;
      current[i+1] = avgG;
      current[i+2] = avgB;
      next[i] = avgR;
      next[i+1] = avgG;
      next[i+2] = avgB;
    }
  }

  const finalIterations = Math.max(iterations, 60);

  for (let it = 0; it < finalIterations; it++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        if (maskData[idx] > 128) {
          const neighbors = [
            idx - 4, idx + 4,
            idx - (width * 4), idx + (width * 4)
          ];

          let r = 0, g = 0, b = 0;
          for (const nIdx of neighbors) {
             r += current[nIdx];
             g += current[nIdx + 1];
             b += current[nIdx + 2];
          }

          next[idx] = r / 4;
          next[idx+1] = g / 4;
          next[idx+2] = b / 4;
        }
      }
    }
    current.set(next);
  }

  imgData.data.set(current);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
