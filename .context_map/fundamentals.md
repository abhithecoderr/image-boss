# Project Fundamentals

###### This document explains the core programming concepts and technologies utilized in the **Image Boss** project. It serves as a learning bridge for understanding how React, Browser APIs, and AI models work together.

---

## 1. React Foundations

### 1.1 State (`useState`)

- **Definition**: A hook that allows functional components to maintain internal data that triggers a re-render when changed.
- **Syntax**: `const [state, setState] = useState(initialValue);`
- **Working**: When `setState` is called, React schedules a re-render of the component. The new value is preserved across renders.
- **Example**:

  ```javascript
  const [isOpen, setIsOpen] = useState(false);
  // toggle: setIsOpen(!isOpen)
  ```
- **Project Reference**: Used extensively in `AppContext.jsx` to track `isProcessing`, `progress`, and `currentService`.

### 1.2 `useEffect`

- **Definition**: A hook that allows functional components to perform side effects (data fetching, subscriptions, manual DOM changes).
- **Syntax**: `useEffect(() => { ... return () => cleanup(); }, [deps]);`
- **Working**: It runs after the component renders. If the dependency array is empty, it runs once on mount. If dependencies change, it runs again (after cleaning up the previous run).
- **Example**:

  ```javascript
  useEffect(() => {
    console.log("Component mounted");
  }, []);
  ```
- **Project Reference**: Used across components to sync canvas data, e.g., in `Workspace.jsx` to redraw the canvas when state updates.

### 1.3 `useRef`

- **Definition**: A hook that returns a mutable ref object whose `.current` property is persisted across renders without triggering a new render.
- **Syntax**: `const myRef = useRef(initialValue);`
- **Working**: Used to store direct references to DOM elements or to hold values that don't affect the UI layout (like timers).
- **Example**:

  ```javascript
  const inputRef = useRef(null);
  // access: inputRef.current.focus()
  ```
- **Project Reference**: Used for `<canvas>` references in `Workspace.jsx` and for toast notification timers in `AppContext.jsx`.

### 1.4 Context API

- **Definition**: A mechanism for sharing data across the entire component tree without passing props manually at every level ("prop drilling").
- **Syntax**: `const MyContext = createContext(); <MyContext.Provider value={...}>`
- **Working**: The `Provider` broadcasts its `value` to all descendant components that use the `useContext` hook.
- **Example**:

  ```javascript
  const theme = useContext(ThemeContext);
  ```
- **Project Reference**: Implemented in `AppContext.jsx` via `AppProvider` to distribute global image and status data.

### 1.5 `useCallback` & `useMemo`

- **Definition**: Optimization hooks used to memoize functions (`useCallback`) and computed values (`useMemo`) to prevent unnecessary reapplications.
- **Syntax**:

  - `const fn = useCallback(() => { ... }, [deps]);`
  - `const val = useMemo(() => compute(), [deps]);`
- **Working**: They return a cached version of the function/value as long as the dependencies in the array remain unchanged.
- **Example**:

  ```javascript
  const heavyValue = useMemo(() => expensiveMath(data), [data]);
  ```
- **Project Reference**: Fixed in `AppContext.jsx` to wrap the `contextValue` and `selectService` function, ensuring the app remains performant during high-frequency progress updates.

---

## 2. Browser Graphics Pipeline

### 2.1 The Canvas API (`HTMLCanvasElement`)

- **Definition**: An HTML element used to draw graphics on the fly via scripting (usually JavaScript).
- **Syntax**: `<canvas ref={canvasRef} />`
- **Working**: It provides a fixed-size resolution drawing surface. You access its "context" to perform drawing operations.
- **Example**:

  ```javascript
  const ctx = canvas.getContext('2d');
  ctx.fillRect(0, 0, 100, 100);
  ```
- **Project Reference**: The backbone of `Workspace.jsx`, where two canvases (`srcRef` and `resRef`) display the original and processed images.

### 2.2 `drawImage()`

- **Definition**: A context method used to draw an image, canvas, or video onto the target canvas.
- **Syntax**: `ctx.drawImage(source, dx, dy, dWidth, dHeight);`
- **Working**: It takes a source (like an `HTMLImageElement` or another `Canvas`) and paints its pixels onto the current canvas at specified coordinates.
- **Example**:

  ```javascript
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ```
- **Project Reference**: Used in `canvas-utils.js` and `Workspace.jsx` to render loaded images and AI results into the UI.

### 2.3 `getImageData()` & `putImageData()`

- **Definition**: Low-level methods to read and write raw pixel data (RGBA values) from/to a rectangular area of a canvas.
- **Syntax**: `const data = ctx.getImageData(x, y, w, h); ctx.putImageData(data, x, y);`
- **Working**: `getImageData` returns a `Uint8ClampedArray` where every pixel is 4 numbers (Red, Green, Blue, Alpha). This is essentially how AI models "see" the image as math.
- **Example**:

  ```javascript
  const pixels = ctx.getImageData(0, 0, width, height);
  // Modify pixels.data[0] to change red channel
  ctx.putImageData(pixels, 0, 0);
  ```
- **Project Reference**: Utilized in advanced operations like blurring or morphological cleanup in some AI processing steps.

### 2.4 `ImageBitmap` & Transferable Objects

- **Definition**: A high-performance bitmap representation of an image that can be transferred across threads efficiently.
- **Syntax**: `const bitmap = await createImageBitmap(canvas);`
- **Working**: Unlike typical data, "transferable" objects are moved from one thread to another without being copied, which is nearly instantaneous regardless of image size.
- **Example**:

  ```javascript
  worker.postMessage({ image: bitmap }, [bitmap]);
  ```
- **Project Reference**: Used for seamless data transfer between the main UI thread and AI Web Workers to prevent UI lag.

---

## 3. In-Browser AI (Transformers.js)

### 3.1 The Pipeline Pattern

- **Definition**: A high-level abstraction that bundles a model with its required pre-processing (pixels-to-tensors) and post-processing (tensors-to-labels).
- **Syntax**: `const pipe = await pipeline('task', 'model-id');`
- **Working**: When called, it downloads the model (if not cached), initializes the execution engine (WASM/WebGPU), and returns a function ready for inference.
- **Example**:

  ```javascript
  const out = await pipe(inputImage);
  ```
- **Project Reference**: Orchestrated in `useProcessor.js` and individual service processors like `background-removal/processor.js`.

### 3.2 Pre-processing & Post-processing

- **Definition**: The steps taken to prepare raw browser data for an AI model (Pre) and to convert AI tensors back into human-readable pixels (Post).
- **Syntax**: `const inputs = await processor(image); const pixels = RawImage.fromTensor(output_tensor);`
- **Working**: Models require specific input shapes (e.g., 512x512). Pre-processing handles resizing and normalization. Post-processing handles masking, thresholding, and alpha-blending.
- **Example**:

  ```javascript
  const mask = output_tensor.sigmoid().gt(0.5); // Post-processing threshold
  ```
- **Project Reference**: Detailed custom post-processing logic can be found in `background-removal/processor.js`.

### 3.3 Web Workers

- **Definition**: A browser feature that allows running scripts in background threads, separate from the main UI thread.
- **Syntax**: `const worker = new Worker(new URL('./worker.js', import.meta.url));`
- **Working**: Workers communicate via messages (`postMessage`). This prevents heavy AI computations from freezing the user interface.
- **Example**:

  ```javascript
  worker.postMessage({ task: 'process', data });
  ```
- **Project Reference**: Critical for all AI services to ensure the app remains responsive while heavy models are running.

---

## 4. Engineering Patterns

### 4.1 The Registry Pattern

- **Definition**: A design pattern where a centralized object or file maps identifiers (IDs) to their respective configurations or logic.
- **Syntax**: `export const SERVICES = { [id]: { name, component, config } };`
- **Working**: It allows the application to be "data-driven." Instead of hardcoding AI logic into the UI, the UI simply asks the Registry for the configuration of the current `serviceId`.
- **Example**:

  ```javascript
  const service = SERVICES[currentId];
  return <h1>{service.name}</h1>;
  ```
- **Project Reference**: Defined in `config.js`, which controls everything from available models to Sidebar navigation labels.

### 4.2 Async Action Orchestration

- **Definition**: The coordination of multiple asynchronous events (loading models, processing data, updating progress bars) to ensure a predictable UI state.
- **Syntax**: `try { await start(); update(); } finally { end(); }`
- **Working**: Using `async/await` with `try/finally` patterns ensures that loading spinners are always cleared, even if an AI model fails to initialize.
- **Example**:

  ```javascript
  setIsProcessing(true);
  try {
    await runAI();
  } finally {
    setIsProcessing(false);
  }
  ```
- **Project Reference**: Standard pattern used in `useProcessor.js` and `Workspace.jsx`.
