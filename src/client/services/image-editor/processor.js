/**
 * Image Editor Processor
 * Bakes CSS filters, SVG filters, crops, and rotations into a permanent canvas.
 * Implements professional-grade adjustments: Highlights, Shadows, Temp, Tint, and more.
 */

export default {
  /**
   * Process the image with the given editing options
   * @param {HTMLCanvasElement|OffscreenCanvas} sourceCanvas 
   * @param {Object} options Editor settings
   */
  process: async (sourceCanvas, options) => {
    const { 
      cropPixels, 
      rotation = 0, 
      flipX = false, 
      flipY = false,
      // Adjustments (Light)
      exposure = 0,
      contrast = 0,
      highlights = 0,
      shadows = 0,
      whites = 0,
      blacks = 0,
      // Adjustments (Color)
      temperature = 0,
      tint = 0,
      saturation = 0,
      vibrance = 0,
      hue = 0,
      // Adjustments (Effects)
      clarity = 0,
      texture = 0,
      sharpening = 0,
      vignette = 0,
      grain = 0,
      dehaze = 0,
      blur = 0,
      // Preset Filter
      preset = 'none',
      intensity = 100
    } = options;

    const targetWidth = cropPixels ? cropPixels.width : sourceCanvas.width;
    const targetHeight = cropPixels ? cropPixels.height : sourceCanvas.height;
    const isPortrait = rotation === 90 || rotation === 270;
    const canvasWidth = isPortrait ? targetHeight : targetWidth;
    const canvasHeight = isPortrait ? targetWidth : targetHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    // 1. GENERATE ADVANCED SVG FILTER
    const filterId = `filter_${Math.random().toString(36).substr(2, 9)}`;
    
    // TEMPERATURE & TINT (±20 range, professional subtlety)
    const t = temperature / 100; 
    const ti = tint / 100;
    const rMod = 1 + (t > 0 ? t : 0) + (ti > 0 ? ti * 0.5 : 0);
    const gMod = 1 + (t > 0 ? t * 0.5 : t * -0.5) + (ti < 0 ? -ti : 0);
    const bMod = 1 + (t < 0 ? -t : 0) + (ti > 0 ? ti * 0.5 : 0);

    // HIGHLIGHTS & SHADOWS (Luminance Table Mapping)
    // We create a table of 10 points to define the tone curve
    const getToneTable = (h, s, w, b, cl, dh) => {
      let table = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      
      // Blacks: Offset the start of the table (Positive = Lighter/Lifted)
      const blackOffset = b / 100; 
      table[0] = Math.max(0, table[0] + blackOffset);
      table[1] = Math.max(0, table[1] + blackOffset * 0.5);

      // Shadows: Affect index 1-4 (0.1 to 0.4)
      const shadowMod = s / 60;
      table[1] += shadowMod * 0.8;
      table[2] += shadowMod * 0.6;
      table[3] += shadowMod * 0.4;
      table[4] += shadowMod * 0.2;

      // Highlights: Affect index 6-9 (0.6 to 0.9)
      const highlightMod = h / 60;
      table[6] += highlightMod * 0.2;
      table[7] += highlightMod * 0.4;
      table[8] += highlightMod * 0.6;
      table[9] += highlightMod * 0.8;

      // Whites: Offset the end of the table
      const whiteOffset = w / 100;
      if (whiteOffset > 0) {
        // Boost: Pull highs toward 1.0
        table[9] += whiteOffset * 0.4;
        table[8] += whiteOffset * 0.2;
      } else {
        // Dim: Pull 1.0 down
        table[10] = Math.max(0, table[10] + whiteOffset);
        table[9] += whiteOffset * 0.5;
      }

      // Clarity: Mid-tone contrast boost (S-Curve)
      if (cl !== 0) {
        const cMod = cl / 100;
        table[3] -= cMod * 0.05;
        table[4] -= cMod * 0.1;
        table[5] += cMod * 0.1;
        table[6] += cMod * 0.1;
        table[7] += cMod * 0.05;
      }

      // Dehaze: Global black pull and contrast boost
      if (dh !== 0) {
          const dMod = dh / 100;
          table[0] = Math.max(0, table[0] - dMod * 0.2);
          table[1] -= dMod * 0.15;
          table[2] -= dMod * 0.1;
          table[8] += dMod * 0.1;
          table[9] += dMod * 0.15;
      }

      return table.map(v => Math.max(0, Math.min(1, v))).join(' ');
    };

    const toneTable = getToneTable(highlights, shadows, whites, blacks, clarity, dehaze);

    const svgFilter = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <filter id="${filterId}" color-interpolation-filters="sRGB">
          <!-- Temp & Tint -->
          <feColorMatrix type="matrix" values="${rMod} 0 0 0 0 0 ${gMod} 0 0 0 0 0 ${bMod} 0 0 0 0 0 1 0"/>
          
          <!-- Advanced Tone Mapping (Highlights/Shadows/Clarity/Dehaze) -->
          <feComponentTransfer>
            <feFuncR type="table" tableValues="${toneTable}" />
            <feFuncG type="table" tableValues="${toneTable}" />
            <feFuncB type="table" tableValues="${toneTable}" />
          </feComponentTransfer>

          <!-- Texture (Subtle Detail Enhancement) -->
          ${texture !== 0 ? `
          <feConvolveMatrix order="3" kernelMatrix="
            0 -${texture/40} 0
            -${texture/40} ${1 + (texture/10)} -${texture/40}
            0 -${texture/40} 0
          " preserveAlpha="true"/>` : ''}

          <!-- Sharpening (Surgical Edge Enhancement, Normalized to preserve brightness) -->
          ${sharpening > 0 ? `
          <feConvolveMatrix order="3" kernelMatrix="
            -${sharpening/20} -${sharpening/20} -${sharpening/20}
            -${sharpening/20} ${1 + (sharpening/2.5)} -${sharpening/20}
            -${sharpening/20} -${sharpening/20} -${sharpening/20}
          " preserveAlpha="true"/>` : ''}
        </filter>
      </svg>
    `.replace(/\s+/g, ' ').trim();

    const encodedFilter = btoa(svgFilter);
    const filterUrl = `url('data:image/svg+xml;base64,${encodedFilter}#${filterId}')`;

    // 2. COMBINE WITH CSS FILTERS
    let cssFilters = '';
    cssFilters += `brightness(${100 + (exposure * 5)}%) `;
    cssFilters += `contrast(${100 + (contrast * 3)}%) `;
    
    // Improved Vibrance/Saturation logic (Clamped to prevent negative values)
    const totalSat = Math.max(0, 100 + (saturation * 4) + (vibrance * 2));
    cssFilters += `saturate(${totalSat}%) `;
    
    if (hue) cssFilters += `hue-rotate(${hue}deg) `;
    
    // Combine explicit blur with sharpening-based softening
    const finalBlur = blur + (sharpening < 0 ? Math.abs(sharpening) / 4 : 0);
    if (finalBlur) cssFilters += `blur(${finalBlur}px) `;

    if (preset !== 'none') {
      const alpha = intensity / 100;
      if (preset === 'bw') cssFilters += `grayscale(${100 * alpha}%) `;
      if (preset === 'sepia') cssFilters += `sepia(${100 * alpha}%) `;
      if (preset === 'vintage') {
        cssFilters += `sepia(${30 * alpha}%) `;
        cssFilters += `contrast(${100 + (90 - 100) * alpha}%) `;
        cssFilters += `brightness(${100 + (110 - 100) * alpha}%) `;
      }
      if (preset === 'cinematic') {
        cssFilters += `contrast(${100 + (120 - 100) * alpha}%) `;
        cssFilters += `saturate(${100 + (80 - 100) * alpha}%) `;
        cssFilters += `hue-rotate(${-10 * alpha}deg) `;
      }
    }

    ctx.filter = `${cssFilters} ${filterUrl}`.trim();

    // 3. DRAW
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    if (rotation) ctx.rotate((rotation * Math.PI) / 180);
    if (flipX || flipY) ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);

    const sx = cropPixels ? cropPixels.x : 0;
    const sy = cropPixels ? cropPixels.y : 0;
    const sw = cropPixels ? cropPixels.width : sourceCanvas.width;
    const sh = cropPixels ? cropPixels.height : sourceCanvas.height;

    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);

    // 4. OVERLAYS (Reset transform)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Vignette
    if (vignette !== 0) {
      const grad = ctx.createRadialGradient(
        canvasWidth / 2, canvasHeight / 2, 0,
        canvasWidth / 2, canvasHeight / 2, Math.sqrt(canvasWidth**2 + canvasHeight**2) / 2
      );
      const alpha = Math.abs(vignette) / 40;
      const color = vignette > 0 ? '0,0,0' : '255,255,255';
      grad.addColorStop(0.4, `rgba(${color}, 0)`);
      grad.addColorStop(1, `rgba(${color}, ${alpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Grain
    if (grain > 0) {
      const gCanvas = document.createElement('canvas');
      gCanvas.width = 128; gCanvas.height = 128;
      const gCtx = gCanvas.getContext('2d');
      const gData = gCtx.createImageData(128, 128);
      for (let i = 0; i < gData.data.length; i += 4) {
        const val = Math.random() * 255;
        gData.data[i] = gData.data[i+1] = gData.data[i+2] = val;
        gData.data[i+3] = grain * 5; 
      }
      gCtx.putImageData(gData, 0, 0);
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = ctx.createPattern(gCanvas, 'repeat');
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.globalCompositeOperation = 'source-over';
    }

    return canvas;
  }
};
