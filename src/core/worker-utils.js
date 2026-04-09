import { RawImage } from "@huggingface/transformers";

/**
 * Detect WebGPU and fp16 support
 */
export async function getGPUConfig() {
  if (!navigator.gpu) return { supported: false, fp16: false };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { supported: false, fp16: false };
    const hasFP16 = adapter.features.has("shader-f16");
    return { supported: true, fp16: hasFP16 };
  } catch (err) {
    return { supported: false, fp16: false };
  }
}

/**
 * Extract mask from pipeline output and convert to transferrable ImageBitmap.
 * Handles RawImage, [{mask: RawImage}], and raw Tensor outputs.
 */
let workerImageCanvas = null;
let workerImageCtx = null;

export async function rawImageToBitmap(rawImg) {
  const w = Math.round(rawImg.width);
  const h = Math.round(rawImg.height);
  
  if (!workerImageCanvas || workerImageCanvas.width !== w || workerImageCanvas.height !== h) {
    workerImageCanvas = new OffscreenCanvas(w, h);
    workerImageCtx = workerImageCanvas.getContext('2d');
  }

  let data = rawImg.data;
  if (!(data instanceof Uint8ClampedArray)) {
    data = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  }

  const imgData = new ImageData(data, w, h);
  workerImageCtx.putImageData(imgData, 0, 0);
  return await createImageBitmap(workerImageCanvas);
}

/**
 * Converts an ImageBitmap (received from UI) into a RawImage (for transformers inference).
 */
export async function bitmapToRawImage(bitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return await RawImage.fromCanvas(canvas);
}
