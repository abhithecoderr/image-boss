/**
 * Sends an image + text prompt to the LFM 2.5 VL captioning API and returns the generated caption string.
 * Unlike the image models (which return a Blob), this endpoint returns plain text.
 * @param {string} apiUrl - Base API URL
 * @param {Blob|File} imageFile - The original image file
 * @param {object} [options] - Additional parameters
 * @param {string} [options.model='lfm2.5-vl'] - Model choice
 * @param {string} [options.device='cpu'] - Hardware device ('cpu' or 'gpu')
 * @param {string} [options.prompt='What is in this image?'] - Text prompt describing what to generate
 * @returns {Promise<string>} Generated caption text
 */
export async function captionImage(apiUrl, imageFile, options = {}) {
    const model = options.model || 'lfm2.5-vl';
    const device = options.device || 'cpu';
    const prompt = options.prompt || 'What is in this image?';

    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('model', model);
    formData.append('device', device);
    formData.append('vlm_prompt', prompt);

    const url = `${apiUrl.replace(/\/$/, '')}/predict?model=${model}&device=${device}`;
    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LFM-VL API Error: ${response.status} - ${errorText}`);
    }

    return await response.text();
}
