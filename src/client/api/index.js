import { birefnetPredict, applyBirefnetMask, removeBackground, loadImage } from './birefnet.js';
import { samPredict, applySamCutout, applySamOverlay, segmentImage } from './sam.js';
import { upscaleImage } from './esrgan.js';

export class ImageBossSDK {
    /**
     * Creates an instance of the ImageBossSDK.
     * @param {string} apiUrl - Base URL of your API endpoint (either your Hono proxy Worker or direct Modal serve endpoint)
     */
    constructor(apiUrl) {
        if (!apiUrl) {
            throw new Error('ImageBossSDK requires an apiUrl during initialization.');
        }
        this.apiUrl = apiUrl.replace(/\/$/, '');
    }

    /**
     * Removes the background of an image and returns a transparent PNG image Blob directly.
     * @param {Blob|File} imageFile - The original image file
     * @param {object} [options] - Additional configuration
     * @param {string} [options.model='birefnet-lite'] - Model choice ('birefnet-lite' or 'birefnet-general')
     * @param {string} [options.device='cpu'] - Hardware device ('cpu' or 'gpu')
     * @returns {Promise<Blob>} Transparent PNG image Blob
     */
    async removeBackground(imageFile, options = {}) {
        return removeBackground(this.apiUrl, imageFile, options);
    }

    /**
     * Fetches only the grayscale mask representing the foreground cutout.
     * Useful if you want to handle the canvas rendering/blending yourself.
     * @param {Blob|File} imageFile - The original image file
     * @param {object} [options] - Additional configuration (model, device)
     * @returns {Promise<Blob>} Grayscale mask PNG Blob
     */
    async getBackgroundMask(imageFile, options = {}) {
        return birefnetPredict(this.apiUrl, imageFile, options);
    }

    /**
     * Segments a target object in an image based on interactive point-clicks.
     * @param {Blob|File} imageFile - The original image file
     * @param {Array<Array<number>>} points - Coordinate array of clicks [[x1, y1], [x2, y2], ...]
     * @param {Array<number>} labels - Label array [1, 0, ...] (1 for foreground point, 0 for background point)
     * @param {object} [options] - Additional configuration
     * @param {string} [options.outputMode='cutout'] - Rendering style ('cutout' for transparent background, 'overlay' for color highlight)
     * @param {string} [options.overlayColor='rgba(0, 100, 255, 0.55)'] - Highlight color code when outputMode is 'overlay'
     * @param {string} [options.model='sam-small'] - Model choice ('sam-tiny', 'sam-small', 'sam-large')
     * @param {string} [options.device='cpu'] - Hardware device ('cpu' or 'gpu')
     * @returns {Promise<Blob>} Processed PNG image Blob
     */
    async segmentImage(imageFile, points, labels, options = {}) {
        return segmentImage(this.apiUrl, imageFile, points, labels, options);
    }

    /**
     * Fetches only the grayscale mask of the segmented region.
     * @param {Blob|File} imageFile - The original image file
     * @param {Array<Array<number>>} points - Coordinate array of clicks [[x, y]]
     * @param {Array<number>} labels - Labels array [1]
     * @param {object} [options] - Additional configuration (model, device)
     * @returns {Promise<Blob>} Grayscale mask PNG Blob
     */
    async getSegmentationMask(imageFile, points, labels, options = {}) {
        return samPredict(this.apiUrl, imageFile, points, labels, { ...options, outputType: 'mask' });
    }

    /**
     * Upscales an image 4x using Real-ESRGAN.
     * @param {Blob|File} imageFile - The original image file
     * @param {object} [options] - Additional configuration
     * @param {string} [options.model='esrgan'] - Model choice ('esrgan')
     * @param {string} [options.device='gpu'] - Hardware device ('gpu' or 'cpu')
     * @returns {Promise<Blob>} Upscaled JPEG image Blob
     */
    async upscaleImage(imageFile, options = {}) {
        return upscaleImage(this.apiUrl, imageFile, options);
    }
}

// Re-export utility and canvas helpers for custom integrations
export {
    loadImage,
    applyBirefnetMask,
    applySamCutout,
    applySamOverlay
};

export default ImageBossSDK;
