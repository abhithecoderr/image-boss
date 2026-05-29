import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useService, useSegmentation } from "../../context/AppContext";
import { getEditorStyles } from "../../core/editorFilters";

// ---------------------------------------------------------------------------
// Unified Adjustable Crop Component
// ---------------------------------------------------------------------------
const UnifiedCrop = ({
  imgSrc,
  filterStyle,
  aspectRatio,
  onCropReady,
  onInteraction,
}) => {
  const imgRef = useRef(null);
  const isInteracting = useRef(false);
  const [crop, setCrop] = useState(null);
  const [naturalAspect, setNaturalAspect] = useState(undefined);

  const aspect = useMemo(() => {
    if (!aspectRatio || aspectRatio === "free") return undefined;
    if (aspectRatio === "original") return naturalAspect;
    const parts = aspectRatio.split(":");
    if (parts.length === 2) return parseFloat(parts[0]) / parseFloat(parts[1]);
    return undefined;
  }, [aspectRatio, naturalAspect]);

  const [isReady, setIsReady] = useState(false);

  const resetToDefaultCrop = useCallback(() => {
    if (!imgRef.current) return;
    const { naturalWidth: nw, naturalHeight: nh } = imgRef.current;

    let initialCrop;
    if (aspectRatio === "original") {
      initialCrop = { unit: "%", x: 0, y: 0, width: 100, height: 100 };
    } else if (aspect) {
      initialCrop = centerCrop(
        makeAspectCrop({ unit: "%", width: 90 }, aspect, nw, nh),
        nw,
        nh,
      );
    } else {
      initialCrop = centerCrop({ unit: "%", width: 80, height: 80 }, nw, nh);
    }

    setCrop(initialCrop);
    setIsReady(true);
  }, [aspect, aspectRatio]);

  const onImageLoad = useCallback(
    (e) => {
      const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
      imgRef.current = e.currentTarget;
      const aspectVal = nw / nh;
      setNaturalAspect(aspectVal);
      resetToDefaultCrop();
    },
    [resetToDefaultCrop],
  );

  // Handle programmatic ratio changes (from dropdown)
  useEffect(() => {
    if (!isInteracting.current) {
      resetToDefaultCrop();
    }
  }, [aspectRatio, resetToDefaultCrop]);

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

  const onComplete = useCallback(
    (pixelCrop) => {
      if (!imgRef.current || !pixelCrop.width || !pixelCrop.height) return;
      const {
        naturalWidth: nw,
        naturalHeight: nh,
        width: dw,
        height: dh,
      } = imgRef.current;
      const scaleX = nw / dw;
      const scaleY = nh / dh;
      onCropReady({
        x: pixelCrop.x * scaleX,
        y: pixelCrop.y * scaleY,
        width: pixelCrop.width * scaleX,
        height: pixelCrop.height * scaleY,
      });
    },
    [onCropReady],
  );

  return (
    <div className="editor-preview-crop-wrapper">
      <ReactCrop
        crop={crop}
        onChange={(c) => {
          if (aspectRatio === "original") {
            isInteracting.current = true;
            onInteraction?.();
          }
          setCrop(c);
        }}
        onComplete={(c) => {
          isInteracting.current = false;
          onComplete(c);
        }}
        aspect={aspect}
        keepSelection
      >
        <img
          ref={imgRef}
          src={imgSrc}
          onLoad={onImageLoad}
          className="editor-preview-img"
          style={{ filter: filterStyle }}
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
  const { serviceSettings, updateServiceSetting } = useService();
  const { activeEditorTab } = useSegmentation();
  const settings = useMemo(
    () => serviceSettings["image-editor"] || {},
    [serviceSettings],
  );
  const {
    aspectRatio = "free",
    rotation = 0,
    flipX = false,
    flipY = false,
    vignette = 0,
  } = settings;

  const [imgSrc, setImgSrc] = useState("");
  useEffect(() => {
    if (!sourceCanvas) {
      setImgSrc("");
      return;
    }
    let objectUrl = "";
    let isMounted = true;
    sourceCanvas.toBlob(
      (blob) => {
        if (blob && isMounted) {
          objectUrl = URL.createObjectURL(blob);
          setImgSrc(objectUrl);
        }
      },
      "image/jpeg",
      0.9,
    );

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceCanvas]);

  const { css: filterStyle, svg: svgFilterContent } = useMemo(() => {
    return getEditorStyles(settings);
  }, [settings]);

  const onCropReady = useCallback(
    (pixels) => {
      updateServiceSetting("image-editor", "cropPixels", pixels);
    },
    [updateServiceSetting],
  );

  const handleInteraction = useCallback(() => {
    updateServiceSetting("image-editor", "aspectRatio", "free");
  }, [updateServiceSetting]);

  if (!imgSrc)
    return <div className="editor-preview-placeholder">Load image</div>;

  return (
    <div className="editor-preview-container">
      {svgFilterContent && (
        <div
          style={{ height: 0, width: 0, overflow: "hidden" }}
          dangerouslySetInnerHTML={{ __html: svgFilterContent }}
        />
      )}
      {vignette !== 0 && (
        <div
          className="editor-preview-vignette"
          style={{
            background: `radial-gradient(circle, transparent 40%, rgba(${vignette > 0 ? "0,0,0" : "255,255,255"}, ${Math.abs(vignette) / 40}) 100%)`,
          }}
        />
      )}
      <div
        className="editor-preview-transform-wrapper"
        style={{
          transform: `rotate(${rotation}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
        }}
      >
        {activeEditorTab === "composition" ? (
          <UnifiedCrop
            imgSrc={imgSrc}
            filterStyle={filterStyle}
            aspectRatio={aspectRatio}
            onCropReady={onCropReady}
            onInteraction={handleInteraction}
          />
        ) : (
          <img
            src={imgSrc}
            className="editor-preview-img"
            style={{ filter: filterStyle }}
            alt="Preview"
            draggable={false}
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(EditorPreview);
