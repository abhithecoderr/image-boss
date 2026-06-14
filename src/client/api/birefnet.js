/**
 * Helper to load an image File, Blob, or URL into an HTMLImageElement in the browser.
 * @param {Blob|File|string} src - The image source (Blob, File, or URL)
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error('Failed to load image: ' + e.message));
        if (src instanceof Blob || src instanceof File) {
            img.src = URL.createObjectURL(src);
        } else {
            img.src = src;
        }
    });
}

/**
 * Automatically detects if a mask is inverted by sampling corner pixels,
 * and corrects it to the standard format (black background, white foreground) if needed.
 * @param {Blob} maskBlob - Raw mask Blob
 * @returns {Promise<Blob>} Corrected or original mask Blob
 */
export async function ensureStandardMask(maskBlob) {
    const img = await loadImage(maskBlob);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    
    const w = canvas.width;
    const h = canvas.height;
    if (w < 2 || h < 2) {
        if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
        return maskBlob;
    }
    
    // Sample four corners (using R channel value)
    const tl = data[0];
    const tr = data[(w - 1) * 4];
    const bl = data[(h - 1) * w * 4];
    const br = data[((h - 1) * w + (w - 1)) * 4];
    
    const avgCorner = (tl + tr + bl + br) / 4;
    
    if (img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
    }
    
    // Standard format: background is black (0), foreground is white (255)
    // If average corner is bright (> 128), background is white (inverted)
    if (avgCorner > 128) {
        console.log(`[SDK] Inverted mask detected (average corner intensity: ${avgCorner}). Inverting mask to standard format...`);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];       // R
            data[i + 1] = 255 - data[i + 1]; // G
            data[i + 2] = 255 - data[i + 2]; // B
        }
        ctx.putImageData(imgData, 0, 0);
        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
    }
    
    return maskBlob;
}

/**
 * Sends an image to the BiRefNet API and returns the raw grayscale mask Blob.
 * @param {string} apiUrl - Base API URL (e.g. 'https://username--image-boss-onnx-serve.modal.run')
 * @param {Blob|File} imageFile - The original image file
 * @param {object} [options] - Additional parameters
 * @param {string} [options.model='birefnet-lite'] - Model choice ('birefnet-lite' or 'birefnet-general')
 * @param {string} [options.device='cpu'] - Hardware device ('cpu' or 'gpu')
 * @returns {Promise<Blob>} Grayscale mask Blob
 */
export async function birefnetPredict(apiUrl, imageFile, options = {}) {
    const model = options.model || 'birefnet-lite';
    const device = options.device || 'cpu';
    
    const formData = new FormData();
    formData.append('file', imageFile);
    
    const url = `${apiUrl.replace(/\/$/, '')}/predict?model=${model}&device=${device}`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BiRefNet API Error: ${response.status} - ${errorText}`);
    }
    
    const maskBlob = await response.blob();
    return await ensureStandardMask(maskBlob);
}


/**
 * Composites a source image with a grayscale mask to create a transparent cutout.
 * @param {HTMLImageElement} sourceImg - Original loaded image
 * @param {HTMLImageElement} maskImg - Grayscale mask returned by the server
 * @returns {HTMLCanvasElement} - Canvas containing the transparent cutout
 */
export function applyBirefnetMask(sourceImg, maskImg) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceImg.naturalWidth || sourceImg.width;
    canvas.height = sourceImg.naturalHeight || sourceImg.height;
    const ctx = canvas.getContext('2d');

    // 1. Draw the original image
    ctx.drawImage(sourceImg, 0, 0);

    // 2. Get pixel data of the original image
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // 3. Draw the mask to an off-screen canvas to extract its grayscale values
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
    const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height).data;

    // 4. Copy the Red channel (grayscale value) of the mask to the Alpha channel of the original image
    for (let i = 0; i < data.length; i += 4) {
        data[i + 3] = maskData[i];
    }

    // 5. Write the transparent cutout back to the canvas
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

/**
 * High-level plug-and-play function to remove the background of an image and return a transparent PNG Blob.
 * @param {string} apiUrl - Base API URL
 * @param {Blob|File} imageFile - The original image file
 * @param {object} [options] - Additional parameters (model, device)
 * @returns {Promise<Blob>} Transparent PNG image Blob
 */
export async function removeBackground(apiUrl, imageFile, options = {}) {
    // 1. Get the mask from the API
    const maskBlob = await birefnetPredict(apiUrl, imageFile, options);
    
    // 2. Load both images in the browser
    const [sourceImg, maskImg] = await Promise.all([
        loadImage(imageFile),
        loadImage(maskBlob)
    ]);
    
    // 3. Create transparent canvas cutout
    const canvas = applyBirefnetMask(sourceImg, maskImg);
    
    // Clean up memory
    if (sourceImg.src.startsWith('blob:')) URL.revokeObjectURL(sourceImg.src);
    if (maskImg.src.startsWith('blob:')) URL.revokeObjectURL(maskImg.src);
    
    // 4. Return canvas as PNG Blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}
