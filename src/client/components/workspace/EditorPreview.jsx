/*
 * Overlay preview canvas responsible for drawing overlay masks, manual brush touch-ups, and interactive segment selection.
 */
import React, {
  useState,
  useRef,
  useEffect,
} from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useService, useWorkspace, useUI } from "../../store";
import { getEditorStyles } from "../../utils/editorFilters";

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

  // Computed ratio value - React Compiler automatically memoizes this calculation
  let aspect = undefined;
  if (aspectRatio && aspectRatio !== "free") {
    if (aspectRatio === "original") {
      aspect = naturalAspect;
    } else {
      const parts = aspectRatio.split(":");
      if (parts.length === 2) {
        aspect = parseFloat(parts[0]) / parseFloat(parts[1]);
      }
    }
  }

  const [isReady, setIsReady] = useState(false);

  const resetToDefaultCrop = () => {
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
  };

  const onImageLoad = (e) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    imgRef.current = e.currentTarget;
    const aspectVal = nw / nh;
    setNaturalAspect(aspectVal);
    resetToDefaultCrop();
  };

  // Handle programmatic ratio changes (from dropdown)
  useEffect(() => {
    if (!isInteracting.current) {
      resetToDefaultCrop();
    }
  }, [aspectRatio]);

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

  const onComplete = (pixelCrop) => {
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
  };

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
  const activeEditorTab = useUI((state) => state.activeEditorTab);
  const settings = serviceSettings["image-editor"] || {};
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

  const { css: filterStyle, svg: svgFilterContent } = getEditorStyles(settings);

  const onCropReady = (pixels) => {
    updateServiceSetting("image-editor", "cropPixels", pixels);
  };

  const handleInteraction = () => {
    updateServiceSetting("image-editor", "aspectRatio", "free");
  };

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

export default EditorPreview;
