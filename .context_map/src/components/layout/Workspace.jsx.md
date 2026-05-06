**Purpose:**

Handles the main workspace area. Manages image upload area, source and result canvas, progress and status bar, service specific canvas rendering (comparison slider for upscaling and sam overlay for object segmentation), download buttons, mask editor and segmentation candidates.

Also integrates batch strip for batch mode


**Code structure:**

*Imports*

```js
import React, { useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useFileIngestion } from "../hooks/useFileIngestion";
import SAMOverlay from "./features/SAMOverlay";
import SegmentationCandidates from "./features/SegmentationCandidates";
import ComparisonSlider from "./features/ComparisonSlider";
import MaskEditorOverlay from "./features/MaskEditorOverlay";
import { downloadCanvas } from "../core/canvas-utils";
```

*Component declaration and state setup*

```js
const Workspace = () => {
  const {
    originalCanvas: srcCanvasState,
    resultCanvas: resCanvasState,
    isProcessing,
    progress,
    currentService,
  } = useApp();

  const { handleFile } = useFileIngestion();
  const srcRef = useRef(null);
  const resRef = useRef(null);
  ```


  *UseEffect to sync source canvas to dom ref*

  ```js
  useEffect(() => {
    if (srcCanvasState && srcRef.current) {
      const ctx = srcRef.current.getContext("2d");
      srcRef.current.width = srcCanvasState.width;
      srcRef.current.height = srcCanvasState.height;
      ctx.drawImage(srcCanvasState, 0, 0);
    }
  }, [srcCanvasState]);
  ```


  *UseEffect for syncing result canvas to dom ref*

 ```js
  useEffect(() => {
    if (!resRef.current) return;
    const ctx = resRef.current.getContext("2d");

    if (resCanvasState) {
      resRef.current.width = resCanvasState.width;
      resRef.current.height = resCanvasState.height;

      const isValidSource =
        resCanvasState instanceof HTMLCanvasElement ||
        resCanvasState instanceof OffscreenCanvas ||
        resCanvasState instanceof ImageBitmap;

      if (isValidSource) {
        ctx.drawImage(resCanvasState, 0, 0);
      }
    } else {
      // Clear canvas if no result
      ctx.clearRect(0, 0, resRef.current.width, resRef.current.height);
    }
  }, [resCanvasState]);
  ```

*Event listener*

const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleFile(file);
    }
  };


*Upload image section if no srcCanvas state (no image uploaded)*

```js
if (!srcCanvasState) {
    return (
      <div
        className="upload-area"
        onClick={() => document.getElementById("file-input").click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="upload-content">
          <div className="upload-icon">📁</div>
          <h2>Drop your image here</h2>
          <p>or click to browse</p>
          <div className="upload-hint">Supports PNG, JPG, WebP (Max 5MB)</div>
        </div>
        <input
          type="file"
          id="file-input"
          hidden
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>
    );
  }
  ```

  *Rest of the workspace code*




