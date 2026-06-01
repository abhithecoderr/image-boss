/**
 * Helper utilities for the Image Captioning service.
 * Handles main-thread canvas text rendering, word wrapping, and overlay layouts.
 */

/**
 * Create a canvas with the generated caption overlay at the bottom.
 * Handles Inter font styles, automatic line wrapping, and dynamic canvas resizing.
 * 
 * @param {HTMLCanvasElement} sourceCanvas The original image canvas
 * @param {string} caption The generated text caption
 * @returns {HTMLCanvasElement} A new canvas containing the image with the caption bar
 */
export function createCaptionOverlay(sourceCanvas, caption) {
  const resultCanvas = document.createElement('canvas');
  const ctx = resultCanvas.getContext('2d');

  // Setup font for measurement
  const fontSize = 24;
  ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
  const maxWidth = sourceCanvas.width - 80;

  // 1. Calculate word wrap and required height
  const words = caption.split(' ');
  const lines = [];
  let currentLine = '';

  for (let word of words) {
    const testLine = currentLine + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && currentLine !== '') {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine.trim());

  const lineHeight = fontSize * 1.4;
  const textHeight = lines.length * lineHeight;
  const verticalPadding = 60;
  const bottomBarHeight = textHeight + verticalPadding;

  // 2. Setup Canvas Dimensions
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height + bottomBarHeight;

  // Re-apply font after resize
  ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;

  // 3. Render
  // Background
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);

  // Original Image
  ctx.drawImage(sourceCanvas, 0, 0);

  // Caption Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  lines.forEach((line, i) => {
    const y = sourceCanvas.height + (verticalPadding / 2) + (i * lineHeight) + (lineHeight / 2);
    ctx.fillText(line, resultCanvas.width / 2, y);
  });

  // Store caption for copy functionality if needed
  resultCanvas.dataset.caption = caption;

  return resultCanvas;
}
