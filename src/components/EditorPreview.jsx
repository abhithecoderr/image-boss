import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useApp } from '../context/AppContext';

// ---------------------------------------------------------------------------
// Unified Adjustable Crop Component
// ---------------------------------------------------------------------------
const UnifiedCrop = ({ imgSrc, filterStyle, aspectRatio, onCropReady }) => {
  const imgRef = useRef(null);
  const [crop, setCrop] = useState(null);
  
  const aspect = useMemo(() => {
    if (!aspectRatio || aspectRatio === 'free') return undefined;
    if (aspectRatio === 'original' && imgRef.current) {
      return imgRef.current.naturalWidth / imgRef.current.naturalHeight;
    }
    const parts = aspectRatio.split(':');
    if (parts.length === 2) return parseFloat(parts[0]) / parseFloat(parts[1]);
    return undefined;
  }, [aspectRatio]);

  const [isReady, setIsReady] = useState(false);

  const onImageLoad = useCallback((e) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    imgRef.current = e.currentTarget;
    let initialCrop;
    if (aspect) {
      const imgAspect = nw / nh;
      if (imgAspect > aspect) {
        const w = (nh * aspect / nw) * 100;
        initialCrop = { unit: '%', x: (100 - w) / 2, y: 0, width: w, height: 100 };
      } else {
        const h = (nw / aspect / nh) * 100;
        initialCrop = { unit: '%', x: 0, y: (100 - h) / 2, width: 100, height: h };
      }
    } else {
      initialCrop = { unit: '%', x: 10, y: 10, width: 80, height: 80 };
    }
    setCrop(initialCrop);
    setIsReady(true);
  }, [aspect]);

  useEffect(() => {
    if (isReady && crop && imgRef.current) {
        const { naturalWidth: nw, naturalHeight: nh } = imgRef.current;
        onCropReady({
            x: (crop.x / 100) * nw,
            y: (crop.y / 100) * nh,
            width: (crop.width / 100) * nw,
            height: (crop.height / 100) * nh,
        });
        setIsReady(false);
    }
  }, [isReady, crop, onCropReady]);

  const onComplete = useCallback((pixelCrop) => {
    if (!imgRef.current || !pixelCrop.width || !pixelCrop.height) return;
    const { naturalWidth: nw, naturalHeight: nh, width: dw, height: dh } = imgRef.current;
    const scaleX = nw / dw;
    const scaleY = nh / dh;
    onCropReady({
      x: pixelCrop.x * scaleX,
      y: pixelCrop.y * scaleY,
      width: pixelCrop.width * scaleX,
      height: pixelCrop.height * scaleY,
    });
  }, [onCropReady]);

  return (
    <div style={styles.cropWrapper}>
      <ReactCrop
        crop={crop}
        onChange={c => setCrop(c)}
        onComplete={onComplete}
        aspect={aspect}
        keepSelection
      >
        <img
          ref={imgRef}
          src={imgSrc}
          onLoad={onImageLoad}
          style={{ ...styles.img, filter: filterStyle }}
          alt="Crop Source"
          draggable={false}
        />
      </ReactCrop>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const EditorPreview = ({ sourceCanvas }) => {
  const { serviceSettings, updateServiceSetting, activeEditorTab } = useApp();
  const settings = serviceSettings['image-editor'] || {};
  const { 
    aspectRatio = 'free', rotation = 0, flipX = false, flipY = false, 
    intensity = 100, preset = 'none',
    exposure = 0, contrast = 0, saturation = 0, hue = 0, blur = 0,
    temperature = 0, tint = 0, highlights = 0, shadows = 0, whites = 0, blacks = 0,
    vibrance = 0, clarity = 0, texture = 0, sharpening = 0, vignette = 0, dehaze = 0
  } = settings;

  const [imgSrc, setImgSrc] = useState('');
  useEffect(() => {
    if (!sourceCanvas) { setImgSrc(''); return; }
    setImgSrc(sourceCanvas.toDataURL());
  }, [sourceCanvas]);

  const filterStyle = useMemo(() => {
    // 1. CSS
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

    // 2. SVG Advanced
    const t = temperature / 100;
    const ti = tint / 100;
    const rMod = 1 + (t > 0 ? t : 0) + (ti > 0 ? ti * 0.5 : 0);
    const gMod = 1 + (t > 0 ? t * 0.5 : t * -0.5) + (ti < 0 ? -ti : 0);
    const bMod = 1 + (t < 0 ? -t : 0) + (ti > 0 ? ti * 0.5 : 0);

    // Tone Curve
    let table = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    
    const blackOffset = blacks / 100; 
    table[0] = Math.max(0, table[0] + blackOffset);
    table[1] = Math.max(0, table[1] + blackOffset * 0.5);

    const shadowMod = shadows / 60;
    table[1] += shadowMod * 0.8; table[2] += shadowMod * 0.6; table[3] += shadowMod * 0.4;
    
    const highlightMod = highlights / 60;
    table[6] += highlightMod * 0.2; table[7] += highlightMod * 0.4; table[8] += highlightMod * 0.6; table[9] += highlightMod * 0.8;
    
    const whiteOffset = whites / 100;
    if (whiteOffset > 0) {
      table[9] += whiteOffset * 0.4; table[8] += whiteOffset * 0.2;
    } else {
      table[10] = Math.max(0, table[10] + whiteOffset);
      table[9] += whiteOffset * 0.5;
    }

    const clMod = clarity / 100;
    table[3] -= clMod * 0.05; table[4] -= clMod * 0.1; table[5] += clMod * 0.1; table[6] += clMod * 0.1; table[7] += clMod * 0.05;

    const dMod = dehaze / 100;
    table[0] = Math.max(0, table[0] - dMod * 0.2); table[1] -= dMod * 0.15; table[2] -= dMod * 0.1; table[8] += dMod * 0.1; table[9] += dMod * 0.15;

    const toneTable = table.map(v => Math.max(0, Math.min(1, v))).join(' ');

    const svgFilter = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <filter id="f" color-interpolation-filters="sRGB">
          <feColorMatrix type="matrix" values="${rMod} 0 0 0 0 0 ${gMod} 0 0 0 0 0 ${bMod} 0 0 0 0 0 1 0"/>
          <feComponentTransfer><feFuncR type="table" tableValues="${toneTable}"/><feFuncG type="table" tableValues="${toneTable}"/><feFuncB type="table" tableValues="${toneTable}"/></feComponentTransfer>
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
    
    const encoded = btoa(svgFilter);
    return `${css.join(' ')} url('data:image/svg+xml;base64,${encoded}#f')`;
  }, [settings, preset, intensity, exposure, contrast, saturation, hue, blur, temperature, tint, highlights, shadows, whites, blacks, vibrance, clarity, texture, sharpening, dehaze]);

  const onCropReady = useCallback((pixels) => {
    updateServiceSetting('image-editor', 'cropPixels', pixels);
  }, [updateServiceSetting]);

  if (!imgSrc) return <div className="result-placeholder">Load image</div>;

  return (
    <div style={styles.container}>
      {vignette !== 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
          background: `radial-gradient(circle, transparent 40%, rgba(${vignette > 0 ? '0,0,0' : '255,255,255'}, ${Math.abs(vignette)/40}) 100%)`
        }} />
      )}
      <div style={{
          transform: `rotate(${rotation}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
          transition: 'transform 0.3s ease-out',
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {activeEditorTab === 'composition' ? (
          <UnifiedCrop key={aspectRatio} imgSrc={imgSrc} filterStyle={filterStyle} aspectRatio={aspectRatio} onCropReady={onCropReady} />
        ) : (
          <img src={imgSrc} style={{ ...styles.img, filter: filterStyle }} alt="Preview" draggable={false} />
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { position: 'relative', width: '100%', height: '100%', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', overflow: 'hidden' },
  img: { display: 'block', maxWidth: '100%', maxHeight: '100%', userSelect: 'none' },
  cropWrapper: { display: 'inline-block', lineHeight: 0 },
};

export default EditorPreview;
