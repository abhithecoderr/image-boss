/**
 * Helper utilities for the Face Blur service.
 * Handles downloader streams, NMS bounding-box suppression, and canvas ellipsoidal blurring.
 */
import { canvasCache } from "../../utils/canvas-utils.js";



/**
 * Standard IOU-based Non-Maximum Suppression (NMS).
 * Eliminates overlapping bounding boxes and retains high confidence predictions.
 */
export function nms(candidates, iouThreshold) {
  candidates.sort((a, b) => b.score - a.score);
  const kept = [];
  const suppressed = new Set();

  for (let i = 0; i < candidates.length; i++) {
    if (suppressed.has(i)) continue;
    const a = candidates[i];
    kept.push(a);

    for (let j = i + 1; j < candidates.length; j++) {
      if (suppressed.has(j)) continue;
      const b = candidates[j];

      const iou = calculateIOU(a.box, b.box);
      if (iou > iouThreshold) suppressed.add(j);
    }
  }
  return kept;
}

/**
 * Calculate the Intersection over Union (IOU) of two bounding boxes.
 */
export function calculateIOU(box1, box2) {
  const x1 = Math.max(box1.xmin, box2.xmin);
  const y1 = Math.max(box1.ymin, box2.ymin);
  const x2 = Math.min(box1.xmax, box2.xmax);
  const y2 = Math.min(box1.ymax, box2.ymax);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = (box1.xmax - box1.xmin) * (box1.ymax - box1.ymin);
  const area2 = (box2.xmax - box2.xmin) * (box2.ymax - box2.ymin);

  return intersection / (area1 + area2 - intersection);
}



/**
 * Apply ellipses blurs over detected faces/persons on an OffscreenCanvas.
 * 
 * @param {ImageBitmap} bitmap Source image bitmap
 * @param {number} width Original image width
 * @param {number} height Original image height
 * @param {Array} detections List of detected box and keypoint objects
 * @param {Object} options Blur strength and shape controls
 * @returns {Promise<ImageBitmap>} Rendered output image containing blurs
 */
export async function applyBlur(bitmap, width, height, detections, options = {}) {
  const {
    blurAmount = 20,
    radiusScale = 1.0,
    feathering = 0.75,
    shape = 1.0,
  } = options;

  const { canvas: workerBlurCanvas, ctx: workerBlurCtx } = canvasCache.get('blur', width, height);

  workerBlurCtx.clearRect(0, 0, width, height);
  workerBlurCtx.drawImage(bitmap, 0, 0);

  if (detections.length === 0) {
    return await createImageBitmap(workerBlurCanvas);
  }

  for (const person of detections) {
    const keypoints = person.keypoints;
    if (!keypoints || keypoints.length < 5) continue;

    const nose_kp = keypoints[0];
    const lEye_kp = keypoints[1];
    const rEye_kp = keypoints[2];

    const nose = { x: nose_kp[0], y: nose_kp[1], score: nose_kp[2] };
    const lEye = { x: lEye_kp[0], y: lEye_kp[1], score: lEye_kp[2] };
    const rEye = { x: rEye_kp[0], y: rEye_kp[1], score: rEye_kp[2] };

    let radius;
    if (
      lEye.score > 0.2 &&
      rEye.score > 0.2 &&
      (lEye.x !== 0 || rEye.x !== 0)
    ) {
      const dx_eyes = lEye.x * width - rEye.x * width;
      const dy_eyes = lEye.y * height - rEye.y * height;
      const dist = Math.sqrt(dx_eyes * dx_eyes + dy_eyes * dy_eyes);
      radius = dist * 2.2 * radiusScale;
    } else {
      const box = person.box;
      radius = (box.xmax - box.xmin) * width * 0.18 * radiusScale;
    }

    const minRadius = Math.min(width, height) * 0.015;
    if (radius < minRadius) radius = minRadius;

    const maxAllowedRadius = Math.min(width, height) * 0.4;
    if (radius > maxAllowedRadius) radius = maxAllowedRadius;

    const nx = nose.x * width;
    const ny = nose.y * height;

    if (isNaN(nx) || isNaN(ny) || isNaN(radius)) continue;

    const radiusY = radius * shape;

    workerBlurCtx.save();

    // Apply blur filter first, then clip to ensure blur stays within bounds
    workerBlurCtx.filter = `blur(${blurAmount}px)`;

    // Create elliptical clip path
    workerBlurCtx.beginPath();
    workerBlurCtx.ellipse(nx, ny, radius, radiusY, 0, 0, Math.PI * 2);
    workerBlurCtx.clip();

    // Draw the source bitmap onto the result canvas
    workerBlurCtx.drawImage(bitmap, 0, 0);

    workerBlurCtx.restore();
  }

  return await createImageBitmap(workerBlurCanvas);
}
