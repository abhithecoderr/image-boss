import { createCanvas, canvasCache } from "./canvas-utils.js";
export { createCanvas, canvasCache };

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

  if (
    !workerImageCanvas ||
    workerImageCanvas.width !== w ||
    workerImageCanvas.height !== h
  ) {
    workerImageCanvas = new OffscreenCanvas(w, h);
    workerImageCtx = workerImageCanvas.getContext("2d");
  }

  let data = rawImg.data;
  if (!(data instanceof Uint8ClampedArray)) {
    data = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  }

  // Handle 1-channel (grayscale/alpha mask) or 3-channel (RGB) by converting to 4-channel (RGBA)
  const channels = rawImg.channels || Math.round(data.length / (w * h));
  if (channels === 1) {
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = data[i]; // R
      rgba[i * 4 + 1] = data[i]; // G
      rgba[i * 4 + 2] = data[i]; // B
      rgba[i * 4 + 3] = 255; // A
    }
    data = rgba;
  } else if (channels === 3) {
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = data[i * 3]; // R
      rgba[i * 4 + 1] = data[i * 3 + 1]; // G
      rgba[i * 4 + 2] = data[i * 3 + 2]; // B
      rgba[i * 4 + 3] = 255; // A
    }
    data = rgba;
  }

  const imgData = new ImageData(data, w, h);
  workerImageCtx.putImageData(imgData, 0, 0);
  return await createImageBitmap(workerImageCanvas);
}

/**
 * Converts an ImageBitmap (received from UI) into a RawImage (for transformers inference).
 */
export async function bitmapToRawImage(bitmap) {
  const { RawImage } = await import("@huggingface/transformers");
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  return RawImage.fromCanvas(canvas);
}

/**
 * Helper to infer the PROGRESS_STAGE based on message content.
 */
function inferStage(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("download") || m.includes("fetch")) return "downloading";
  if (m.includes("init") || m.includes("load") || m.includes("start") || m.includes("prepare")) return "initializing";
  if (m.includes("save") || m.includes("render") || m.includes("final")) return "saving";
  return "processing"; // Default fallback
}

/**
 * Creates a standardized progress reporter for AI tasks.
 * Maps a localized task (0-100%) to a global progress range (start-end).
 *
 * @param {Function} onProgress The callback that sends the actual message (prog, msg)
 * @returns {Function} A factory function (start, end, prefix) => callback
 */
export function createProgressReporter(onProgress) {
  return (start, end, messagePrefix = "Downloading...") => {
    let lastPct = 0;
    let currentFile = "";

    return (p) => {
      let pct = lastPct;

      if (p && typeof p === "object") {
        if (p.file) {
          currentFile = p.file;
        }

        if (p.status === "progress") {
          pct = p.total ? ((p.loaded ?? 0) / p.total) * 100 : (p.progress ?? 0);
          lastPct = pct;
        } else if (p.status === "done") {
          pct = 100;
          lastPct = 0; // Reset for next file
        } else if (p.status === "initiate") {
          pct = 0;
          lastPct = 0;
        }
      } else if (typeof p === "number") {
        pct = p;
        lastPct = p;
      }

      const globalProgress = start + (pct / 100) * (end - start);
      const stage = inferStage(messagePrefix);

      let file = currentFile;
      if (!file && messagePrefix.startsWith("Downloading ")) {
        file = messagePrefix.replace("Downloading ", "").replace("...", "");
      }

      onProgress?.({
        stage,
        percent: Math.round(globalProgress * 100),
        message: messagePrefix,
        details: {
          file,
          globalProgress,
        }
      });
    };
  };
}

/**
 * Standardized generic runner for Web Worker tasks.
 * Abstracts Promises, listeners, cleanups, progress reporting, and errors.
 */
export function runWorkerJob(
  worker,
  actionType,
  payload,
  transferables = [],
  onProgress = null,
) {
  const PROGRESS_THROTTLE = 100;
  let lastProgressTime = 0;
  let lastMessage = "";

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener("message", messageHandler);
      worker.removeEventListener("error", errorHandler);
    };

    const messageHandler = ({ data }) => {
      const { type, progress, message, result, error } = data;

      if (type === "progress") {
        const now = Date.now();
        const msgText = (typeof progress === "object" && progress !== null) ? progress.message : message;
        if (
          now - lastProgressTime > PROGRESS_THROTTLE ||
          progress === 1 ||
          msgText !== lastMessage
        ) {
          let normalizedProgress = progress;
          if (typeof progress !== "object" || progress === null) {
            // Normalize legacy format
            const rawPercent = typeof progress === "number" ? Math.round(progress * 100) : 0;
            const inferred = inferStage(message);
            normalizedProgress = {
              stage: inferred,
              percent: rawPercent,
              message: message || "Processing...",
              details: {}
            };
          }

          onProgress?.(normalizedProgress);
          lastProgressTime = now;
          lastMessage = msgText;
        }
      } else if (type === "complete") {
        cleanup();
        resolve(result);
      } else if (type === "error") {
        cleanup();
        reject(new Error(error));
      }
    };

    const errorHandler = (err) => {
      cleanup();
      reject(new Error(err.message || "Worker task execution failure."));
    };

    worker.addEventListener("message", messageHandler);
    worker.addEventListener("error", errorHandler, { once: true });

    worker.postMessage({ type: actionType, payload }, transferables);
  });
}

/**
 * Download a binary model buffer while sending chunk-based progress reporting.
 * Utilizes the browser's Cache API to store models locally for instant loading.
 */
export async function fetchWithProgress(
  url,
  label,
  report,
  startWeight,
  endWeight,
  cacheName = "ai-model-cache-v1",
) {
  let cache;
  let response;
  if (typeof caches !== "undefined") {
    try {
      cache = await caches.open(cacheName);
      response = await cache.match(url);
    } catch (err) {
      console.warn("[worker-utils] Cache Storage match failed:", err);
    }
  }

  if (response) {
    console.log(`[worker-utils] ${label} loaded from Cache API`);
    return await response.arrayBuffer();
  }

  const netResponse = await fetch(url);
  if (!netResponse.ok) {
    throw new Error(`Failed to fetch ${label}: ${netResponse.statusText}`);
  }

  const contentLength = netResponse.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = netResponse.clone().body.getReader();
  const chunks = [];
  const reportProgress = report(
    startWeight,
    endWeight,
    `Downloading ${label}...`,
  );

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;

    if (total) {
      reportProgress((loaded / total) * 100);
    }
  }

  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  if (cache) {
    try {
      await cache.put(url, netResponse);
    } catch (err) {
      console.warn("[worker-utils] Failed to cache file:", err);
    }
  }

  return result.buffer;
}

/**
 * Resize and package image pixels from ImageBitmap into a normalized Float32Array tensor.
 * Can target NHWC or NCHW layout, with optional mean/std normalization.
 */
export async function imageToTensor(bitmap, size, options = {}) {
  const {
    mean = [0, 0, 0],
    std = [1, 1, 1],
    layout = "NCHW",
    scale = 1.0 / 255.0,
  } = options;

  const { canvas, ctx } = canvasCache.get('image_to_tensor', size, size);
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const pixels = imgData.data;

  const totalPixels = size * size;
  const tensorData = new Float32Array(3 * totalPixels);

  if (layout === "NHWC") {
    for (let i = 0; i < totalPixels; i++) {
      const pIdx = i * 4;
      tensorData[i * 3] = (pixels[pIdx] * scale - mean[0]) / std[0]; // R
      tensorData[i * 3 + 1] = (pixels[pIdx + 1] * scale - mean[1]) / std[1]; // G
      tensorData[i * 3 + 2] = (pixels[pIdx + 2] * scale - mean[2]) / std[2]; // B
    }
  } else {
    // NCHW
    const gOffset = totalPixels;
    const bOffset = totalPixels * 2;
    for (let i = 0; i < totalPixels; i++) {
      const pIdx = i * 4;
      tensorData[i] = (pixels[pIdx] * scale - mean[0]) / std[0]; // R
      tensorData[gOffset + i] = (pixels[pIdx + 1] * scale - mean[1]) / std[1]; // G
      tensorData[bOffset + i] = (pixels[pIdx + 2] * scale - mean[2]) / std[2]; // B
    }
  }

  return tensorData;
}

/**
 * Uniform ONNX Runtime configuration helper.
 */
export function configureOrt(ort, threads = null) {
  ort.env.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/";
  const resolvedThreads =
    threads || Math.min(4, self.navigator?.hardwareConcurrency || 4);
  ort.env.wasm.numThreads = resolvedThreads;
  ort.env.wasm.simd = true;
}

/**
 * Factory for an ORT session lifecycle manager.
 *
 * Encapsulates the module-level session/variant/device state plus the
 * re-entrancy guard that several workers (blur, line-art) were copy-pasting
 * with an `isInitializing` busy-wait loop. A single pending-promise replaces
 * the polling loop.
 *
 * Usage:
 *   const mgr = createOrtSessionManager(ort, {
 *     async resolveBuffer(variant, report) { ... return ArrayBuffer },
 *     buildProviders(hw, variant) { return ["webgpu","wasm"] },
 *   });
 *   const session = await mgr.get(variant, onProgress);
 *   mgr.release();  // on dispose
 *
 * @param {object} ort - the onnxruntime-web module
 * @param {object} opts
 * @param {(variant: string, report: Function) => Promise<ArrayBuffer>} opts.resolveBuffer
 * @param {(hw: object, variant: string) => Array} [opts.buildProviders]
 * @returns {{ get: Function, release: Function, getDevice: Function }}
 */
export function createOrtSessionManager(ort, opts) {
  const { resolveBuffer, buildProviders } = opts;
  let session = null;
  let currentVariant = null;
  let currentDevice = null;
  let pendingPromise = null;

  async function get(variant, onProgress) {
    // Already loaded for this variant — reuse.
    if (session && currentVariant === variant) return session;

    // Another caller is already loading — await the same promise (no busy-wait).
    if (pendingPromise) return pendingPromise;

    pendingPromise = (async () => {
      const report = createProgressReporter(onProgress);
      try {
        const modelBuffer = await resolveBuffer(variant, report);

        let executionProviders;
        let deviceLabel = "WASM";
        if (buildProviders) {
          executionProviders = buildProviders(await getGPUConfig(), variant);
          deviceLabel = executionProviders[0] === "webgpu" ? "WEBGPU" : "WASM";
        } else {
          const hw = await getGPUConfig();
          executionProviders = hw.supported ? ["webgpu", "wasm"] : ["wasm"];
          deviceLabel = hw.supported ? "WEBGPU" : "WASM";
        }

        report(0.8, 0.8, `Initializing session (${deviceLabel})...`)(0);
        session = await ort.InferenceSession.create(modelBuffer, {
          executionProviders,
          graphOptimizationLevel: "all",
        });
        currentVariant = variant;
        currentDevice = executionProviders[0] === "webgpu" ? "webgpu" : "wasm";
        report(0.9, 0.9, "Ready")(0);
        return session;
      } catch (err) {
        // Reset so the next call can retry.
        if (session) { try { session.release(); } catch (_) {} }
        session = null;
        currentVariant = null;
        throw err;
      } finally {
        pendingPromise = null;
      }
    })();

    return pendingPromise;
  }

  function release() {
    if (session) {
      try { session.release(); } catch (_) {}
    }
    session = null;
    currentVariant = null;
    currentDevice = null;
  }

  function getDevice() {
    return currentDevice;
  }

  return { get, release, getDevice };
}
