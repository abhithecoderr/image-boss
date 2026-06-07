/**
 * Unified Background Removal Web Worker.
 * Standardizes messaging and coordinates between Transformers.js pipeline and direct ORT runners.
 */

import { runPipeline, releasePipeline } from "./pipeline-runner.js";
import { runOrt, releaseOrt } from "./ort-runner.js";
import { BACKGROUND_REMOVAL_MODELS } from "../../config/models.js";

let currentMethod = null; // 'pipeline' | 'custom'

self.onmessage = async ({ data }) => {
  const { type, payload } = data;

  if (type === "process") {
    try {
      const onProgress = (prog, msg) =>
        self.postMessage({ type: "progress", progress: prog, message: msg });

      const { bitmap, model: modelId } = payload;
      const modelConfig = BACKGROUND_REMOVAL_MODELS[modelId] || BACKGROUND_REMOVAL_MODELS["birefnet-lite"];
      
      // Determine final method: if model configuration has a single fixed method, use it;
      // otherwise, default to the requested payload method or "custom" ORT.
      let method = payload.method || "custom";
      if (modelConfig && modelConfig.method && modelConfig.method !== "hybrid") {
        method = modelConfig.method;
      }

      // Memory release on approach switch
      if (currentMethod && currentMethod !== method) {
        console.log(`[Worker] Switching approach from ${currentMethod} to ${method}. Disposing previous runner memory...`);
        if (currentMethod === "pipeline") releasePipeline();
        if (currentMethod === "custom") releaseOrt();
      }
      currentMethod = method;

      let result;
      if (method === "pipeline") {
        result = await runPipeline(payload, onProgress);
      } else {
        result = await runOrt(payload, onProgress);
      }

      // Clean up input bitmap to avoid leak in main thread / worker
      bitmap.close();

      self.postMessage(
        {
          type: "complete",
          result: {
            resultBitmap: result.resultBitmap,
            width: result.width,
            height: result.height,
            info: {
              device: result.device,
              method: method,
            }
          },
        },
        [result.resultBitmap],
      );
    } catch (err) {
      console.error("[Background Removal Worker] Processing failed:", err);
      self.postMessage({
        type: "error",
        error: err.message || "Background removal execution failed",
      });
    }
  }

  if (type === "clear" || type === "dispose") {
    console.log("[Worker] Evicting background removal models and caches from worker...");
    releasePipeline();
    releaseOrt();
    currentMethod = null;
    self.postMessage({ type: "complete" });
  }
};
