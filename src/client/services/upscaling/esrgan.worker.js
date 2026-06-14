/**
 * Real-ESRGAN Worker using ONNX Runtime directly
 * Handles CNN-based super-resolution (4x upscaling).
 */

import * as ort from "onnxruntime-web/webgpu";
import { createProgressReporter, fetchWithProgress, configureOrt } from "../../core/worker-utils.js";
import { UPSCALING_MODELS } from "../../config/models.js";
import {
  packTilePlanar,
  packTileNHWC,
  unpackTilePlanar,
  unpackTileNHWC,
} from "./helpers.js";

// Configure ONNX Runtime for stability
configureOrt(ort);

let session = null;
let currentModelId = null;
let currentDevice = null;

function releaseSession() {
  if (session) {
    try {
      session.release?.();
    } catch (err) {
      console.warn("Failed to safely release InferenceSession:", err);
    }
    session = null;
    currentDevice = null;
    currentModelId = null;
  }
}

async function getSession(modelId, onProgress) {
  if (session && currentModelId === modelId) return session;

  releaseSession();

  const report = createProgressReporter(onProgress);

  try {
    const modelConfig = UPSCALING_MODELS[modelId] || UPSCALING_MODELS.esrgan;

    // Fetch ONNX model structure
    const modelBuffer = await fetchWithProgress(
      modelConfig.onnxUrl,
      `${modelConfig.name} structure`,
      report,
      0.05,
      0.2,
    );

    const preferredProviders = modelConfig.executionProviders || ["webgpu"];

    const sessionOptions = {
      executionProviders: preferredProviders.map(p => {
        if (p === "webgpu" && modelConfig.forceCpuNodeNames) {
          return {
            name: "webgpu",
            deviceType: "gpu",
            forceCpuNodeNames: modelConfig.forceCpuNodeNames,
          };
        }
        return p;
      }),
      graphOptimizationLevel: "all",
    };

    // Load external weights for ESRGAN
    if (modelConfig.dataUrl) {
      const dataBuffer = await fetchWithProgress(
        modelConfig.dataUrl,
        `${modelConfig.name} weights`,
        report,
        0.2,
        0.35,
      );
      sessionOptions.externalData = [
        {
          path: "model.data",
          data: new Uint8Array(dataBuffer),
        },
      ];
    }

    const deviceLabel = preferredProviders.includes("webgpu") ? "WEBGPU" : "WASM";
    report(
      0.35,
      0.35,
      `Initializing ${modelConfig.name} (${deviceLabel})...`,
    )(0);

    try {
      session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
      currentDevice = preferredProviders.includes("webgpu") ? "webgpu" : "wasm";
    } catch (gpuError) {
      if (preferredProviders.includes("webgpu") && !modelConfig.executionProviders) {
        console.warn(
          `WebGPU EP failed for ${modelConfig.name}, falling back to WASM...`,
          gpuError,
        );
        report(0.38, 0.38, "WebGPU failed. Retrying on CPU (WASM)...")(0);
        sessionOptions.executionProviders = ["wasm"];
        session = await ort.InferenceSession.create(
          modelBuffer,
          sessionOptions,
        );
        currentDevice = "wasm";
      } else {
        console.error(`Execution initialization failed for ${modelConfig.name}:`, gpuError);
        throw new Error(`Failed to initialize session: ${gpuError.message || gpuError}`);
      }
    }

    currentModelId = modelId;
    report(0.4, 0.4, "Model ready")(0);
    return session;
  } catch (err) {
    console.error("Failed to load session:", err);
    throw err;
  }
}

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === "upscale") {
    try {
      const onProgress = (prog, msg) =>
        self.postMessage({ type: "progress", progress: prog, message: msg });
      const report = createProgressReporter(onProgress);

      const params = payload;
      const modelId = params.modelId || "esrgan";
      const modelConfig = UPSCALING_MODELS[modelId] || UPSCALING_MODELS.esrgan;

      const maxInputSize = modelConfig.tileSize;
      const scaleFactor = modelConfig.scale;
      const overlap = modelConfig.overlap;
      const stride = maxInputSize - overlap * 2;

      const originalBitmap = params.bitmap;
      if (!originalBitmap) {
        throw new Error("No bitmap provided for upscaling.");
      }

      const sess = await getSession(modelId, onProgress);

      // Detect channel layouts (NCHW vs NHWC) from models.js configuration
      const isInputNHWC = modelConfig.inputLayout === "NHWC";
      const isOutputNHWC = modelConfig.outputLayout === "NHWC";

      const originalW = originalBitmap.width;
      const originalH = originalBitmap.height;

      // Extract original image pixels once on the CPU
      const originalCanvas = new OffscreenCanvas(originalW, originalH);
      const originalCtx = originalCanvas.getContext("2d", { willReadFrequently: true });
      originalCtx.drawImage(originalBitmap, 0, 0);
      const originalImageData = originalCtx.getImageData(0, 0, originalW, originalH).data;

      const outW = originalW * scaleFactor;
      const outH = originalH * scaleFactor;

      // Allocate single master output pixel array
      const masterOutputData = new Uint8ClampedArray(outW * outH * 4);

      const tiles = [];
      for (let y = 0; y < originalH; y += stride) {
        for (let x = 0; x < originalW; x += stride) {
          tiles.push({ x, y });
        }
      }

      const totalTiles = tiles.length;
      let tilesDone = 0;

      const inputTensorShape = isInputNHWC
        ? [1, maxInputSize, maxInputSize, 3]
        : [1, 3, maxInputSize, maxInputSize];
      const inputTensorData = new Float32Array(3 * maxInputSize * maxInputSize);

      for (const tile of tiles) {
        tilesDone++;

        if (isInputNHWC) {
          packTileNHWC(
            originalImageData,
            originalW,
            originalH,
            tile.x,
            tile.y,
            overlap,
            maxInputSize,
            inputTensorData,
          );
        } else {
          packTilePlanar(
            originalImageData,
            originalW,
            originalH,
            tile.x,
            tile.y,
            overlap,
            maxInputSize,
            inputTensorData,
          );
        }

        const tensor = new ort.Tensor("float32", inputTensorData, inputTensorShape);
        const results = await sess.run({ [sess.inputNames[0]]: tensor });
        const outputData = results[sess.outputNames[0]].data;

        const outOverlap = overlap * scaleFactor;
        const outStride = stride * scaleFactor;
        const outSize = maxInputSize * scaleFactor;

        if (isOutputNHWC) {
          unpackTileNHWC(
            outputData,
            outSize,
            outOverlap,
            outStride,
            masterOutputData,
            outW,
            outH,
            tile.x * scaleFactor,
            tile.y * scaleFactor,
          );
        } else {
          unpackTilePlanar(
            outputData,
            outSize,
            outOverlap,
            outStride,
            masterOutputData,
            outW,
            outH,
            tile.x * scaleFactor,
            tile.y * scaleFactor,
          );
        }

        report(
          0.4,
          0.95,
          `Processed ${tilesDone}/${totalTiles} tiles...`,
        )((tilesDone / totalTiles) * 100);
      }

      report(0.96, 0.99, "Finalizing image...")(0);

      const outputCanvas = new OffscreenCanvas(outW, outH);
      const outputCtx = outputCanvas.getContext("2d");
      const finalImageData = new ImageData(masterOutputData, outW, outH);
      outputCtx.putImageData(finalImageData, 0, 0);

      const resultBitmap = await createImageBitmap(outputCanvas);

      self.postMessage(
        {
          type: "complete",
          result: resultBitmap,
          info: {
            outputSize: `${resultBitmap.width}x${resultBitmap.height}`,
            device: currentDevice,
            model: "upscale",
          },
        },
        [resultBitmap],
      );
    } catch (err) {
      console.error("ESRGAN upscaling error:", err);
      self.postMessage({
        type: "error",
        error: err.message || "Upscaling failed",
      });
    }
  }

  if (type === "dispose") {
    releaseSession();
  }
};
