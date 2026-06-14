import { loadImage, ensureStandardMask } from './birefnet.js';

/**
 * Sends a segmentation request to the SAM 2.1 API and returns the grayscale mask Blob.
 * @param {string} apiUrl - Base API URL
 * @param {Blob|File} imageFile - The original image file
 * @param {Array<Array<number>>} points - Coordinate points array [[x1, y1], [x2, y2]]
 * @param {Array<number>} labels - Labels array [1, 0] (1 for foreground, 0 for background)
 * @param {object} [options] - Additional parameters
 * @param {string} [options.model='sam-small'] - Model choice ('sam-tiny', 'sam-small', 'sam-large')
 * @param {string} [options.device='cpu'] - Hardware device ('cpu' or 'gpu')
 * @param {string} [options.outputType='mask'] - API response format ('mask' or 'overlay')
 * @returns {Promise<Blob>} Grayscale mask or color overlay Blob depending on parameters
 */
export async function samPredict(apiUrl, imageFile, points, labels, options = {}) {
    const model = options.model || 'sam-small';
    const device = options.device || 'cpu';
    const outputType = options.outputType || 'mask';
    
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('model', model);
    formData.append('device', device);
    formData.append('output_type', outputType);
    
    if (points) {
        formData.append('point_coords', JSON.stringify(points));
    }
    if (labels) {
        formData.append('point_labels', JSON.stringify(labels));
    }
    
    const url = `${apiUrl.replace(/\/$/, '')}/predict?model=${model}&device=${device}&t=${Date.now()}`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SAM API Error: ${response.status} - ${errorText}`);
    }
    
    const maskBlob = await response.blob();
    return maskBlob;
}

/**
 * Composites the source image with the segment mask to create a transparent cutout of the segmented object.
 * @param {HTMLImageElement} sourceImg - Original loaded image
 * @param {HTMLImageElement} maskImg - Grayscale mask returned by the server
 * @returns {HTMLCanvasElement} - Canvas containing the transparent cutout
 */
export function applySamCutout(sourceImg, maskImg, isInverted = false) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceImg.naturalWidth || sourceImg.width;
    canvas.height = sourceImg.naturalHeight || sourceImg.height;
    const ctx = canvas.getContext('2d');

    // 1. Draw original background image
    ctx.drawImage(sourceImg, 0, 0);

    // 2. Get pixel data of original image
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // 3. Draw mask to extract grayscale alpha channel values
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const mCtx = maskCanvas.getContext('2d');
    mCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
    const maskData = mCtx.getImageData(0, 0, canvas.width, canvas.height).data;

    // 4. Set alpha to the mask's intensity
    for (let i = 0; i < data.length; i += 4) {
        data[i + 3] = isInverted ? (255 - maskData[i]) : maskData[i];
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

/**
 * Renders a colored semi-transparent highlight overlay over the segmented object.
 * @param {HTMLImageElement} sourceImg - Original loaded image
 * @param {HTMLImageElement} maskImg - Grayscale mask returned by the server
 * @param {string} [color='rgba(0, 100, 255, 0.55)'] - CSS color representation for the highlight overlay
 * @param {boolean} [isInverted=false] - Whether the mask from the server is inverted
 * @returns {HTMLCanvasElement} - Canvas containing the highlight overlay
 */
export function applySamOverlay(sourceImg, maskImg, color = 'rgba(0, 100, 255, 0.55)', isInverted = false) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceImg.naturalWidth || sourceImg.width;
    canvas.height = sourceImg.naturalHeight || sourceImg.height;
    const ctx = canvas.getContext('2d');

    // 1. Draw original background image
    ctx.drawImage(sourceImg, 0, 0);

    // 2. Create off-screen canvas to isolate mask and overlay color
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const mCtx = maskCanvas.getContext('2d');

    mCtx.fillStyle = color;
    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    // 3. Create a temporary canvas to transfer Red channel to Alpha channel
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
    const tData = tCtx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = tData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i + 3] = isInverted ? (255 - pixels[i]) : pixels[i];
    }
    tCtx.putImageData(tData, 0, 0);

    // 4. Clip color overlay to segment mask boundaries
    mCtx.globalCompositeOperation = 'destination-in';
    mCtx.drawImage(tempCanvas, 0, 0);
    mCtx.globalCompositeOperation = 'source-over';

    // 5. Draw overlay onto main canvas
    ctx.drawImage(maskCanvas, 0, 0);
    return canvas;
}
