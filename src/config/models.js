/**
 * Image Boss - Centralized AI Model Configuration
 * This file contains all repository IDs and direct URLs for the AI models used in the app.
 */

// --- Background Removal (RMBG) ---
export const BACKGROUND_REMOVAL_MODELS = {
  modnet: {
    model_id: "Xenova/modnet",
    task: "background-removal",
    default_dtype: "fp32",
    size: 512,
    method: "pipeline",
  },
  inspyrenet_lite: {
    model_id: "TheGuy444/InSpyReNet-Res2Net50",
    task: "background-removal",
    default_dtype: "fp32",
    size: 384,
    method: "pipeline",
  },
  ben2: {
    model_id: "onnx-community/BEN2-ONNX",
    task: "background-removal",
    default_dtype: "fp16",
    size: 512,
    method: "pipeline",
  },
  birefnet: {
    model_id: "onnx-community/BiRefNet_512x512-ONNX",
    size: 512,
    default_dtype: "fp16",
    method: "custom",
  },
  'birefnet-lite': {
    model_id: "studioludens/birefnet-lite-512",
    size: 512,
    default_dtype: "fp16",
    method: "custom",
  },
};

// --- Face/Person Blur (YOLO26) ---
export const BLUR_MODELS = {
  nano: { model_id: "onnx-community/yolo26n-pose-ONNX", method: "custom", default_dtype: "fp32" },
  small: { model_id: "onnx-community/yolo26s-pose-ONNX", method: "custom", default_dtype: "fp32" },
  medium: { model_id: "onnx-community/yolo26m-pose-ONNX", method: "custom", default_dtype: "fp32" },
  large: { model_id: "onnx-community/yolo26l-pose-ONNX", method: "custom", default_dtype: "fp32" },
  xlarge: { model_id: "onnx-community/yolo26x-pose-ONNX", method: "custom", default_dtype: "fp32" },
};

// --- Captioning (Vision-Language Models) ---
export const CAPTIONING_MODELS = {
  lfm: {
    model_id: "LiquidAI/LFM2.5-VL-450M-ONNX",
    method: "custom",
    default_dtype: {
      vision_encoder: 'fp16',
      embed_tokens: 'fp16',
      decoder_model_merged: 'q4',
    }
  },
};

// --- Line Art (AI Sketch) ---
export const LINE_ART_MODELS = {
  anime: {
    url: "https://huggingface.co/x-Liola-x/informative-drawings-onnx/resolve/main/informative-drawings_anime_768x768.onnx",
    method: "custom",
    default_dtype: "fp32"
  },
  contour: {
    url: "https://huggingface.co/x-Liola-x/informative-drawings-onnx/resolve/main/informative-drawings_contour_768x768.onnx",
    method: "custom",
    default_dtype: "fp32"
  },
};

// --- Magic Erase (LaMa Inpainting) ---
export const MAGIC_ERASE_MODELS = {
  lama: {
    url: "https://huggingface.co/TheGuy444/LaMa-Web/resolve/main/onnx/lama.onnx",
    method: "custom",
    default_dtype: "fp32"
  },
};

// --- Object Segmentation (SAM) ---
export const SEGMENTATION_MODELS = {
  slimsam: { model_id: "Xenova/slimsam-77-uniform", method: "custom", default_dtype: "fp32" },
  sam_base: { model_id: "Xenova/sam-vit-base", method: "custom", default_dtype: "fp16" },
};

// --- Upscaling (Real-ESRGAN) ---
export const UPSCALING_MODELS = {
  onnx: {
    url: "https://huggingface.co/TheGuy444/Real-ESRGAN-ONNX/resolve/main/onnx/model.onnx",
    method: "custom",
    default_dtype: "fp32"
  },
  data: {
    url: "https://huggingface.co/TheGuy444/Real-ESRGAN-ONNX/resolve/main/onnx/model.data",
    method: "custom",
    default_dtype: "fp32"
  },
};
