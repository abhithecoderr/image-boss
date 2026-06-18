/**
 * Image Boss - Centralized AI Model Configuration
 * This file contains all repository IDs and direct URLs for the AI models used in the app.
 */


// --- Background Removal (RMBG) ---
export const BACKGROUND_REMOVAL_MODELS = {
  birefnet: {
    model_id: "onnx-community/BiRefNet_512x512-ONNX",
    task: "image-segmentation",
    size: 512,
    default_dtype: "fp16",
    method: "pipeline",
  },
  "birefnet-lite": {
    model_id: "studioludens/birefnet-lite-512",
    task: "image-segmentation",
    size: 512,
    default_dtype: "fp16",
    method: "pipeline",
  },
  isnet: {
    model_id: "onnx-community/ISNet-ONNX",
    task: "background-removal",
    size: 1024,
    default_dtype: "fp32",
    method: "pipeline",
  },
  u2net: {
    model_id: "Heliosoph/u2net-onnx",
    task: "background-removal",
    size: 320,
    default_dtype: "fp32",
    method: "custom",
    model_url: "https://huggingface.co/Heliosoph/u2net-onnx/resolve/main/u2net.onnx",
    output_type: "minmax",
    device: "wasm",
  },
};

// --- Face/Person Blur (YOLO26) ---
export const BLUR_MODELS = {
  nano: {
    model_id: "onnx-community/yolo26n-pose-ONNX",
    method: "custom",
    default_dtype: "fp32",
  },
  small: {
    model_id: "onnx-community/yolo26s-pose-ONNX",
    method: "custom",
    default_dtype: "fp32",
  },
  medium: {
    model_id: "onnx-community/yolo26m-pose-ONNX",
    method: "custom",
    default_dtype: "fp32",
  },
  large: {
    model_id: "onnx-community/yolo26l-pose-ONNX",
    method: "custom",
    default_dtype: "fp32",
  },
  xlarge: {
    model_id: "onnx-community/yolo26x-pose-ONNX",
    method: "custom",
    default_dtype: "fp32",
  },
};

// --- Captioning (Vision-Language Models) ---
export const CAPTIONING_MODELS = {
  lfm: {
    model_id: "LiquidAI/LFM2.5-VL-450M-ONNX",
    method: "custom",
    default_dtype: {
      vision_encoder: "fp16",
      embed_tokens: "fp16",
      decoder_model_merged: "q4",
    },
  },
};

// --- Line Art (AI Sketch) ---
export const LINE_ART_MODELS = {
  anime: {
    url: "https://huggingface.co/x-Liola-x/informative-drawings-onnx/resolve/main/informative-drawings_anime_768x768.onnx",
    method: "custom",
    default_dtype: "fp32",
  },
  contour: {
    url: "https://huggingface.co/x-Liola-x/informative-drawings-onnx/resolve/main/informative-drawings_contour_768x768.onnx",
    method: "custom",
    default_dtype: "fp32",
  },
};

// --- Magic Erase (LaMa Inpainting) ---
export const MAGIC_ERASE_MODELS = {
  lama: {
    url: "https://huggingface.co/TheGuy444/LaMa-Web/resolve/main/onnx/lama.onnx",
    method: "custom",
    default_dtype: "fp32",
  },
};

// --- Object Segmentation (SAM) ---
export const SEGMENTATION_MODELS = {
  sam2_1_tiny: {
    model_id: "onnx-community/sam2.1-hiera-tiny-ONNX",
    method: "custom",
    default_dtype: "fp16",
  },
  sam2_1_small: {
    model_id: "onnx-community/sam2.1-hiera-small-ONNX",
    method: "custom",
    default_dtype: "fp16",
  },
  sam2_1_large: {
    model_id: "onnx-community/sam2.1-hiera-large-ONNX",
    method: "custom",
    default_dtype: "fp16",
  },
};

// --- Upscaling ---
export const UPSCALING_MODELS = {
  esrgan: {
    id: "esrgan",
    name: "Real-ESRGAN (General 4x)",
    onnxUrl:
      "https://huggingface.co/TheGuy444/Real-ESRGAN-ONNX/resolve/main/onnx/model.onnx",
    dataUrl:
      "https://huggingface.co/TheGuy444/Real-ESRGAN-ONNX/resolve/main/onnx/model.data",
    tileSize: 128,
    overlap: 16,
    scale: 4,
    inputLayout: "NCHW",
    outputLayout: "NCHW",
  },
  esrgan_pro: {
    id: "esrgan_pro",
    name: "Real-ESRGAN Pro (General 4x)",
    onnxUrl:
      "https://huggingface.co/FuryTMP/RealESR_Gx4_fp16/resolve/main/RealESR_Gx4_fp16.onnx",
    tileSize: 128,
    overlap: 16,
    scale: 4,
    inputLayout: "NCHW",
    outputLayout: "NCHW",
  },
  esrgan_ultra: {
    id: "esrgan_ultra",
    name: "Real-ESRGAN Ultra (General 4x)",
    onnxUrl:
      "https://huggingface.co/FuryTMP/RealESRGANx4_fp16/resolve/main/RealESRGANx4_fp16.onnx",
    tileSize: 128,
    overlap: 16,
    scale: 4,
    inputLayout: "NCHW",
    outputLayout: "NCHW",
  },
  bsrgan_x4: {
    id: "bsrgan_x4",
    name: "BSRGAN (Detail 4x)",
    onnxUrl:
      "https://huggingface.co/FuryTMP/BSRGANx4_fp16/resolve/main/BSRGANx4_fp16.onnx",
    tileSize: 128,
    overlap: 16,
    scale: 4,
    inputLayout: "NCHW",
    outputLayout: "NCHW",
  },
  bsrgan_x2: {
    id: "bsrgan_x2",
    name: "BSRGAN (Detail 2x)",
    onnxUrl:
      "https://huggingface.co/FuryTMP/BSRGANx2_fp16/resolve/main/BSRGANx2_fp16.onnx",
    tileSize: 256,
    overlap: 16,
    scale: 2,
    inputLayout: "NCHW",
    outputLayout: "NCHW",
  },
  real_esr_anime_x4: {
    id: "real_esr_anime_x4",
    name: "Real-ESRGAN (Anime 4x)",
    onnxUrl:
      "https://huggingface.co/FuryTMP/RealESR_Animex4_fp16/resolve/main/RealESR_Animex4_fp16.onnx",
    tileSize: 128,
    overlap: 16,
    scale: 4,
    inputLayout: "NCHW",
    outputLayout: "NCHW",
  },
};

export const PAID_MODELS_CONFIG = {
  // Background Removal
  "birefnet": {
    api_model_tag: "birefnet-general",
    api_runtime: "cpu"
  },
  "birefnet-lite": {
    api_model_tag: "birefnet-lite",
    api_runtime: "cpu"
  },
  "ben2": {
    api_model_tag: "ben2",
    api_runtime: "cpu"
  },
  // Object Segmentation (local model IDs mapped to API tags)
  "onnx-community/sam2.1-hiera-tiny-ONNX": {
    api_model_tag: "sam-tiny",
    api_runtime: "cpu"
  },
  "onnx-community/sam2.1-hiera-small-ONNX": {
    api_model_tag: "sam-small",
    api_runtime: "cpu"
  },
  "onnx-community/sam2.1-hiera-large-ONNX": {
    api_model_tag: "sam-large",
    api_runtime: "gpu"
  },
  // Upscaling
  "esrgan": {
    api_model_tag: "esrgan",
    api_runtime: "gpu"
  },
  // Captioning (Vision-Language Model)
  "lfm2.5-vl": {
    api_model_tag: "lfm2.5-vl",
    api_runtime: "cpu"
  }
};

