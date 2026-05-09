/**
 * Pure logic for generating image processing filters.
 * Extracted from EditorPreview to improve maintainability and performance.
 */

/**
 * Calculates the 11-point tone curve table for feComponentTransfer.
 * @param {Object} s Settings object containing blacks, shadows, highlights, whites, clarity, dehaze.
 * @returns {string} Space-separated table values.
 */
const calculateToneTable = (s) => {
  let table = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  
  // Blacks
  const blackOffset = (s.blacks || 0) / 100; 
  table[0] = Math.max(0, table[0] + blackOffset);
  table[1] = Math.max(0, table[1] + blackOffset * 0.5);

  // Shadows
  const shadowMod = (s.shadows || 0) / 60;
  table[1] += shadowMod * 0.8; 
  table[2] += shadowMod * 0.6; 
  table[3] += shadowMod * 0.4;
  
  // Highlights
  const highlightMod = (s.highlights || 0) / 60;
  table[6] += highlightMod * 0.2; 
  table[7] += highlightMod * 0.4; 
  table[8] += highlightMod * 0.6; 
  table[9] += highlightMod * 0.8;
  
  // Whites
  const whiteOffset = (s.whites || 0) / 100;
  if (whiteOffset > 0) {
    table[9] += whiteOffset * 0.4; 
    table[8] += whiteOffset * 0.2;
  } else {
    table[10] = Math.max(0, table[10] + whiteOffset);
    table[9] += whiteOffset * 0.5;
  }

  // Clarity (Mid-tone contrast)
  const clMod = (s.clarity || 0) / 100;
  table[3] -= clMod * 0.05; 
  table[4] -= clMod * 0.1; 
  table[5] += clMod * 0.1; 
  table[6] += clMod * 0.1; 
  table[7] += clMod * 0.05;

  // Dehaze
  const dMod = (s.dehaze || 0) / 100;
  table[0] = Math.max(0, table[0] - dMod * 0.2); 
  table[1] -= dMod * 0.15; 
  table[2] -= dMod * 0.1; 
  table[8] += dMod * 0.1; 
  table[9] += dMod * 0.15;

  return table.map(v => Math.max(0, Math.min(1, v))).join(' ');
};

/**
 * Generates standard CSS filter array.
 */
const generateCssFilters = (s) => {
  const { exposure = 0, contrast = 0, saturation = 0, vibrance = 0, hue = 0, blur = 0, sharpening = 0, preset = 'none', intensity = 100 } = s;
  
  let css = [];
  css.push(`brightness(${100 + (exposure * 5)}%)`);
  css.push(`contrast(${100 + (contrast * 3)}%)`);
  
  const totalSat = Math.max(0, 100 + (saturation * 4) + (vibrance * 2));
  css.push(`saturate(${totalSat}%)`);
  
  if (hue) css.push(`hue-rotate(${hue}deg)`);
  
  const finalBlur = blur + (sharpening < 0 ? Math.abs(sharpening) / 4 : 0);
  if (finalBlur) css.push(`blur(${finalBlur}px)`);

  if (preset !== 'none') {
    const alpha = intensity / 100;
    if (preset === 'bw')        css.push(`grayscale(${100 * alpha}%)`);
    if (preset === 'sepia')     css.push(`sepia(${100 * alpha}%)`);
    if (preset === 'vintage') {
      css.push(`sepia(${30 * alpha}%)`);
      css.push(`contrast(${100 + (90 - 100) * alpha}%)`);
      css.push(`brightness(${100 + (110 - 100) * alpha}%)`);
    }
    if (preset === 'cinematic') {
      css.push(`contrast(${100 + (120 - 100) * alpha}%)`);
      css.push(`saturate(${100 + (80 - 100) * alpha}%)`);
      css.push(`hue-rotate(${-10 * alpha}deg)`);
    }
  }

  return css;
};

/**
 * Generates the SVG filter string.
 */
const generateSvgFilter = (s) => {
  const { temperature = 0, tint = 0, texture = 0, sharpening = 0 } = s;
  
  // Temperature / Tint Matrix calculation
  const t = temperature / 100;
  const ti = tint / 100;
  const rMod = 1 + (t > 0 ? t : 0) + (ti > 0 ? ti * 0.5 : 0);
  const gMod = 1 + (t > 0 ? t * 0.5 : t * -0.5) + (ti < 0 ? -ti : 0);
  const bMod = 1 + (t < 0 ? -t : 0) + (ti > 0 ? ti * 0.5 : 0);

  const toneTable = calculateToneTable(s);

  return `
    <svg xmlns="http://www.w3.org/2000/svg">
      <filter id="f" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" values="${rMod} 0 0 0 0 0 ${gMod} 0 0 0 0 0 ${bMod} 0 0 0 0 0 1 0"/>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="${toneTable}"/>
          <feFuncG type="table" tableValues="${toneTable}"/>
          <feFuncB type="table" tableValues="${toneTable}"/>
        </feComponentTransfer>
        ${texture !== 0 ? `<feConvolveMatrix order="3" kernelMatrix="0 -${texture/40} 0 -${texture/40} ${1 + (texture/10)} -${texture/40} 0 -${texture/40} 0" preserveAlpha="true"/>` : ''}
        ${sharpening > 0 ? `
        <feConvolveMatrix order="3" kernelMatrix="
          -${sharpening/20} -${sharpening/20} -${sharpening/20}
          -${sharpening/20} ${1 + (sharpening/2.5)} -${sharpening/20}
          -${sharpening/20} -${sharpening/20} -${sharpening/20}
        " preserveAlpha="true"/>` : ''}
      </filter>
    </svg>
  `.replace(/\s+/g, ' ').trim();
};

/**
 * The main interface for EditorPreview.
 * @param {Object} settings The image-editor settings from AppContext.
 * @returns {Object} Final CSS filter value and SVG markup.
 */
export const getEditorStyles = (settings) => {
  if (!settings) return { css: 'none', svg: null };
  
  const cssParts = generateCssFilters(settings);
  const svgContent = generateSvgFilter(settings).replace('id="f"', 'id="editor-svg-filter"');
  
  return {
    css: `${cssParts.join(' ')} url('#editor-svg-filter')`.trim(),
    svg: svgContent
  };
};
