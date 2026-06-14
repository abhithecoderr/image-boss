# Image-Boss Client SDK

A simple, plug-and-play JavaScript SDK designed to call your deployed Modal image processing APIs and handle high-performance browser-side image processing (like canvas transparency cutouts and colored segmentation overlays).

---

## 🚀 Setup & Integration

### 1. Copy the SDK
Copy this `sdk/` folder directly into your React project's source tree (e.g., under `src/sdk/` or `src/utils/sdk/`).

### 2. Initialize the Client
Create an instance of the SDK client in your app:

```javascript
import ImageBossSDK from './sdk';

// Initialize with your deployed API URL
const imageBoss = new ImageBossSDK('https://your-workspace--image-boss-onnx-serve.modal.run');
```

---

## 💻 React Usage Examples

### 1. Background Removal (BiRefNet)

```jsx
import React, { useState } from 'react';
import { imageBoss } from './api'; // initialized SDK instance

export function BackgroundRemover() {
  const [loading, setLoading] = useState(false);
  const [outputUrl, setOutputUrl] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      // 1. Call SDK to get transparent PNG Blob
      const resultBlob = await imageBoss.removeBackground(file, {
        model: 'birefnet-lite', // or 'birefnet-general'
        device: 'cpu'          // or 'gpu'
      });

      // 2. Create a local URL to render in an <img> tag
      const url = URL.createObjectURL(resultBlob);
      setOutputUrl(url);
    } catch (err) {
      console.error('Failed to remove background:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleUpload} accept="image/*" />
      {loading && <p>Processing background removal...</p>}
      {outputUrl && <img src={outputUrl} alt="Transparent cutout" />}
    </div>
  );
}
```

---

### 2. Interactive Object Segmentation (SAM 2.1)

To segment objects, capture clicks on an image component and pass them as coordinates to the SDK:

```jsx
import React, { useState, useRef } from 'react';
import { imageBoss } from './api';

export function ObjectSegmenter() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [outputUrl, setOutputUrl] = useState(null);
  const imageRef = useRef(null);

  const handleImageClick = async (e) => {
    if (!imageRef.current || !file) return;

    // 1. Get click coordinates relative to the image natural dimensions
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * imageRef.current.naturalWidth;
    const y = ((e.clientY - rect.top) / rect.height) * imageRef.current.naturalHeight;

    const points = [[x, y]];
    const labels = [1]; // 1 for foreground positive click

    try {
      // 2. Call SDK to segment the object (returns transparent cutout)
      const resultBlob = await imageBoss.segmentImage(file, points, labels, {
        outputMode: 'cutout', // or 'overlay'
        model: 'sam-small',   // 'sam-tiny', 'sam-small', 'sam-large'
        device: 'cpu'
      });

      setOutputUrl(URL.createObjectURL(resultBlob));
    } catch (err) {
      console.error('Segmentation failed:', err);
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => {
        const f = e.target.files[0];
        setFile(f);
        setPreviewUrl(URL.createObjectURL(f));
      }} />
      
      {previewUrl && (
        <img 
          ref={imageRef} 
          src={previewUrl} 
          onClick={handleImageClick} 
          style={{ cursor: 'pointer', maxWidth: '500px' }}
          alt="Source"
        />
      )}

      {outputUrl && (
        <div>
          <h3>Segment Output:</h3>
          <img src={outputUrl} alt="Cutout output" />
        </div>
      )}
    </div>
  );
}
```

---

### 3. Image Upscaling (Real-ESRGAN)

```jsx
const handleUpscale = async (file) => {
  try {
    // Returns upscaled JPEG directly (no canvas compositing needed)
    const upscaledBlob = await imageBoss.upscaleImage(file, {
      device: 'gpu' // ESRGAN is configured on L4 GPU
    });
    
    const downloadUrl = URL.createObjectURL(upscaledBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'upscaled_image.jpg';
    link.click();
  } catch (err) {
    console.error('Upscaling failed:', err);
  }
};
```

---

## 🔒 Security Best Practice (Hono & Cloudflare Workers Proxy)

If your React app is public and you want to protect your Modal API from unauthorized access/billing abuse:

1. Deploy the SDK in your **Hono API route** instead of exposing the Modal URL to React.
2. Create a Hono proxy route to parse the file and forward the request to Modal using Hono environment variables (your secret `Modal-Key` and `Modal-Secret` tokens):

```javascript
// Inside your Hono backend Worker:
app.post('/api/proxy/remove-bg', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file; // This is a File object
    
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://your-workspace--image-boss-onnx-serve.modal.run/predict?model=birefnet-lite&device=cpu', {
        method: 'POST',
        headers: {
            'Modal-Key': c.env.MODAL_KEY,
            'Modal-Secret': c.env.MODAL_SECRET
        },
        body: formData
    });

    return new Response(response.body, {
        status: response.status,
        headers: {
            'Content-Type': response.headers.get('Content-Type') || 'image/png'
        }
    });
});
```

3. Then, point your React frontend `ImageBossSDK` instance to `/api/proxy/remove-bg` instead of calling Modal directly.
