/**
 * Sends an image to the Real-ESRGAN API for 4x upscaling and returns the upscaled JPEG Blob.
 * @param {string} apiUrl - Base API URL
 * @param {Blob|File} imageFile - The original image file
 * @param {object} [options] - Additional parameters
 * @param {string} [options.model='esrgan'] - Model choice ('esrgan')
 * @param {string} [options.device='gpu'] - Hardware device ('gpu' or 'cpu')
 * @returns {Promise<Blob>} Upscaled JPEG image Blob
 */
export async function upscaleImage(apiUrl, imageFile, options = {}) {
    const model = options.model || 'esrgan';
    const device = options.device || 'gpu';
    
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('model', model);
    formData.append('device', device);
    
    const url = `${apiUrl.replace(/\/$/, '')}/predict?model=${model}&device=${device}`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Real-ESRGAN API Error: ${response.status} - ${errorText}`);
    }
    
    return await response.blob();
}
