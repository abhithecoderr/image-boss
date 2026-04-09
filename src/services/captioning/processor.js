/**
 * Auto Captioning Processor
 * Uses Web Worker for non-blocking processing
 */

import Worker from './worker.js?worker';

let worker = null;

function getWorker() {
  if (!worker) {
    worker = new Worker();
  }
  return worker;
}

/**
 * Generate caption or segmentation for image
 * @param {HTMLCanvasElement} sourceCanvas - Source image canvas
 * @param {Object} options - Processing options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Result object with canvas and data
 */
export async function process(sourceCanvas, options = {}, onProgress) {
  const isLFM = options.modelId?.includes('LFM');
  const isSegmentation = !isLFM && options.task === '<REFERRING_EXPRESSION_SEGMENTATION>';
  const modelLabel = isLFM ? 'LFM 2.5 VL' : 'Florence-2';
  console.log(`[Processor] Starting ${modelLabel} ${isSegmentation ? 'segmentation' : 'captioning'}...`);

  return new Promise(async (resolve, reject) => {
    const w = getWorker();

    // Use zero-copy ImageBitmap transfer
    const bitmap = await createImageBitmap(sourceCanvas);

    w.onmessage = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === 'progress') {
        onProgress?.(progress, message);
      } else if (type === 'complete') {
        onProgress?.(0.95, 'Rendering result...');

        let resultCanvas;
        let finalValue;

        if (isSegmentation) {
          // Pass result.value directly — it could be a parsed object OR a raw string.
          // createSegmentationOverlay handles both cases.
          resultCanvas = createSegmentationOverlay(sourceCanvas, result.value);
          finalValue = result.value;
        } else {
          // result.value is the caption string
          resultCanvas = createCaptionOverlay(sourceCanvas, result.value);
          finalValue = result.value;
        }

        // Detailed log of structured vision result
        console.log(`[Processor] ${modelLabel} Result:`, result.raw);

        onProgress?.(1, 'Complete!');
        resolve({ canvas: resultCanvas, [isSegmentation ? 'segmentation' : 'captioning']: finalValue });
      } else if (type === 'error') {
        console.error('[Processor] Worker Error:', error);
        reject(new Error(error));
      }
    };

    w.onerror = (err) => reject(new Error(err.message));

    // Send to worker
    w.postMessage({
      type: 'process',
      payload: {
        bitmap,
        modelId: options.modelId || 'onnx-community/Florence-2-base-ft',
        task: options.task || '<MORE_DETAILED_CAPTION>',
        segPrompt: options.segPrompt || '',
        lfmPrompt: options.lfmPrompt || ''
      }
    }, [bitmap]);
  });
}

/**
 * Create canvas with caption overlay
 */
function createCaptionOverlay(sourceCanvas, caption) {
  const resultCanvas = document.createElement('canvas');
  const ctx = resultCanvas.getContext('2d');

  // Setup font for measurement
  const fontSize = 24;
  ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
  const maxWidth = sourceCanvas.width - 80;

  // 1. Calculate word wrap and required height
  const words = caption.split(' ');
  const lines = [];
  let currentLine = '';

  for (let word of words) {
    const testLine = currentLine + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && currentLine !== '') {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine.trim());

  const lineHeight = fontSize * 1.4;
  const textHeight = lines.length * lineHeight;
  const verticalPadding = 60;
  const bottomBarHeight = textHeight + verticalPadding;

  // 2. Setup Canvas Dimensions
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height + bottomBarHeight;

  // Re-apply font after resize
  ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;

  // 3. Render
  // Background
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);

  // Original Image
  ctx.drawImage(sourceCanvas, 0, 0);

  // Caption Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  lines.forEach((line, i) => {
    const y = sourceCanvas.height + (verticalPadding / 2) + (i * lineHeight) + (lineHeight / 2);
    ctx.fillText(line, resultCanvas.width / 2, y);
  });

  // Store caption for copy functionality if needed
  resultCanvas.dataset.caption = caption;

  return resultCanvas;
}

/**
 * Create canvas with segmentation masks (B&W Mask + Color Cutout)
 */
function createSegmentationOverlay(sourceCanvas, segmentationData) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const gap = 20;

  // 1. Resolve Polygons (Handling raw string fallback)
  let polygons = [];
  if (segmentationData && typeof segmentationData === 'object' && segmentationData.polygons) {
    polygons = segmentationData.polygons;
  } else if (typeof segmentationData === 'string') {
    console.warn('[Processor] Post-processor returned raw string. Running manual <loc> parser...', segmentationData);
    const matches = Array.from(segmentationData.matchAll(/<loc_?(\d+)>/g)).map(m => parseInt(m[1]));

    if (matches.length >= 4 && matches.length % 2 === 0) {
      const coords = [];
      for (let i = 0; i < matches.length; i += 2) {
        const x = (matches[i] / 1000) * width;
        const y = (matches[i + 1] / 1000) * height;
        coords.push([x, y]);
      }
      polygons = [coords];
    }
  }

  // Helper to trace a polygon path
  const tracePoly = (ctx, outline, yOffset = 0) => {
    if (!outline || outline.length < 2) return;
    ctx.beginPath();
    if (Array.isArray(outline[0])) {
      ctx.moveTo(outline[0][0], outline[0][1] + yOffset);
      for (let i = 1; i < outline.length; i++) {
        ctx.lineTo(outline[i][0], outline[i][1] + yOffset);
      }
    } else {
      ctx.moveTo(outline[0], outline[1] + yOffset);
      for (let i = 2; i < outline.length; i += 2) {
        ctx.lineTo(outline[i], outline[i + 1] + yOffset);
      }
    }
    ctx.closePath();
  };

  // 2. Create a smooth mask on a temporary canvas (with edge blur for anti-aliasing)
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');

  // Draw polygon mask with blur for smooth edges
  maskCtx.filter = 'blur(1.5px)';
  maskCtx.fillStyle = '#ffffff';
  polygons.forEach(poly => {
    tracePoly(maskCtx, poly, 0);
    maskCtx.fill();
  });
  maskCtx.filter = 'none';

  // 3. Setup final result canvas (B&W Mask + Color Cutout)
  const resultCanvas = document.createElement('canvas');
  const ctx = resultCanvas.getContext('2d');
  resultCanvas.width = width;
  resultCanvas.height = (height * 2) + gap;

  // Fill background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);

  // 4. Draw B&W Mask (Top) — use the smoothed mask
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(maskCanvas, 0, 0);

  // 5. Draw Color Cutout (Bottom) — original image clipped by mask
  const offsetY = height + gap;

  // Create a temp canvas for the cutout compositing
  const cutoutCanvas = document.createElement('canvas');
  cutoutCanvas.width = width;
  cutoutCanvas.height = height;
  const cutoutCtx = cutoutCanvas.getContext('2d');

  // Draw the original image first
  cutoutCtx.drawImage(sourceCanvas, 0, 0);
  // Use 'destination-in' to keep only pixels where the mask is white
  cutoutCtx.globalCompositeOperation = 'destination-in';
  cutoutCtx.drawImage(maskCanvas, 0, 0);
  cutoutCtx.globalCompositeOperation = 'source-over';

  // Stamp the cutout onto the result canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, offsetY, width, height);
  ctx.drawImage(cutoutCanvas, 0, offsetY);

  return resultCanvas;
}


export default { process };
