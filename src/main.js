/**
 * Image Boss - Main Application Controller
 * Handles navigation, service loading, and UI orchestration
 */

import { SERVICES, SERVICE_ORDER } from './config.js';
import { loadImage, imageToCanvas, downloadCanvas, canvasToBlob } from './core/canvas-utils.js';
import { showToast, updateProgress } from './core/ui-utils.js';

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

// Application State
const state = {
  currentService: null,
  originalImage: null,
  originalCanvas: null,
  resultCanvas: null,
  processor: null,
  isProcessing: false,
  // Manual Editing State
  editing: {
    activeTool: 'none', // 'none', 'erase', 'restore'
    brushSize: 30,
    isDrawing: false,
    manualMaskCanvas: null,
    manualMaskCtx: null,
    lastSavedMask: null,
  },
  originalFile: {
    name: '',
    type: '',
  },
  resultLayers: [], // Array of canvases for multi-object detection
  selectedLayerIndex: -1,
  // Comparison Slider State
  comparison: {
    active: false,
    position: 50, // percentage
  },
  samPoints: [], // {x, y, label} 1=pos, 0=neg
  samPointLabel: 1, // 1=Positive (Green), 0=Negative (Red)
};

// DOM Elements
const elements = {
  navServices: document.getElementById('nav-services'),
  uploadArea: document.getElementById('upload-area'),
  fileInput: document.getElementById('file-input'),
  workspace: document.getElementById('workspace'),
  statusBar: document.getElementById('status-bar'),
  originalCanvas: document.getElementById('original-canvas'),
  resultCanvas: document.getElementById('result-canvas'),
  resultPlaceholder: document.getElementById('result-placeholder'),
  controls: document.getElementById('controls'),
  btnNew: document.getElementById('btn-new'),
  btnProcess: document.getElementById('btn-process'),
  btnDownload: document.getElementById('btn-download'),
  layerPicker: document.getElementById('layer-picker'),
  layersContainer: document.getElementById('layers-container'),
  samOverlay: null,
  samRect: null,
};

/**
 * Initialize the application
 */
async function init() {
  renderNavigation();
  createSAMOverlay();
  setupEventListeners();

  // Select first service by default
  selectService(SERVICE_ORDER[0]);
}

/**
 * Create CSS-based overlay for SAM selection to avoid canvas redraw lag
 */
function createSAMOverlay() {
  const wrapper = elements.originalCanvas.parentElement;
  if (!wrapper || document.getElementById('sam-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'sam-overlay';
  overlay.className = 'sam-selection-overlay';

  const rect = document.createElement('div');
  rect.id = 'sam-rect';
  rect.className = 'sam-selection-rect';

  overlay.appendChild(rect);
  wrapper.appendChild(overlay);

  elements.samOverlay = overlay;
  elements.samRect = rect;

  overlay.addEventListener('click', (e) => {
    if (state.currentService?.id !== 'object-segmentation') return;

    const rect = overlay.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const isRefining = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!isRefining) {
      state.samPoints = []; // Reset if not refining
    }

    state.samPoints.push({ x, y, label: state.samPointLabel });
    updateSAMMarkers();
  });

  // Keep in sync
  window.addEventListener('resize', debounce(syncSAMOverlay, 100));
}

/**
 * Synchronize the SAM selection overlay with the displayed original canvas
 */
function syncSAMOverlay() {
  if (!elements.samOverlay || !elements.originalCanvas) return;
  const canvas = elements.originalCanvas;
  const overlay = elements.samOverlay;

  // Use pixel offsets relative to the positioned parent
  overlay.style.width = `${canvas.offsetWidth}px`;
  overlay.style.height = `${canvas.offsetHeight}px`;
  overlay.style.left = `${canvas.offsetLeft}px`;
  overlay.style.top = `${canvas.offsetTop}px`;
}

/**
 * Create floating action bar for refinement
 */
function createRefineOverlay() {
  const wrapper = elements.originalCanvas.parentElement;
  if (!wrapper || document.getElementById('refine-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'refine-overlay';
  overlay.className = 'refine-actions-overlay';
  overlay.innerHTML = `
    <button class="refine-btn generate" title="Run AI with current dots">
      ✨ Generate
    </button>
    <button class="refine-btn cancel" title="Wipe dots">
      ✕ Cancel
    </button>
  `;

  wrapper.appendChild(overlay);

  // Bind actions
  overlay.querySelector('.generate').onclick = (e) => {
    e.stopPropagation();
    smartSelect();
  };
  overlay.querySelector('.cancel').onclick = (e) => {
    e.stopPropagation();
    clearSAMPoints();
  };
}

/**
 * Render navigation items
 */
function renderNavigation() {
  elements.navServices.innerHTML = '';

  SERVICE_ORDER.forEach(serviceId => {
    const service = SERVICES[serviceId];
    const btn = document.createElement('button');
    btn.className = 'nav-item' + (service.disabled ? ' disabled' : '');
    btn.dataset.service = serviceId;
    btn.innerHTML = `
      <span class="icon">${service.icon}</span>
      <span class="label">${service.name}</span>
    `;
    if (!service.disabled) {
      btn.addEventListener('click', () => selectService(serviceId));
    }
    elements.navServices.appendChild(btn);
  });
}

/**
 * Setup Comparison Slider for Upscaling
 * Uses clip-path for a proper before/after reveal effect
 */
function setupComparisonSlider() {
  const resultWrapper = elements.resultCanvas.parentElement;
  if (!resultWrapper) return;

  // Clear previous comparison UI if any
  const existing = resultWrapper.querySelector('.comparison-container');
  if (existing) existing.remove();

  if (state.currentService.id !== 'upscaling' || !state.resultCanvas) {
    elements.resultCanvas.classList.remove('hidden');
    return;
  }

  elements.resultCanvas.classList.add('hidden');
  elements.resultPlaceholder.classList.add('hidden');
  elements.btnDownload.disabled = false;

  // Create container with proper styling
  const container = document.createElement('div');
  container.className = 'comparison-container';
  container.style.cssText = `
    position: relative;
    width: 100%;
    max-width: 100%;
    aspect-ratio: ${state.resultCanvas.width} / ${state.resultCanvas.height};
    overflow: hidden;
    cursor: ew-resize;
    border-radius: var(--radius-lg);
  `;

  // Upscaled image (background, revealed on left)
  const upscaledLayer = document.createElement('div');
  upscaledLayer.className = 'comparison-upscaled';
  upscaledLayer.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  `;
  const upscaledCanvas = document.createElement('canvas');
  upscaledCanvas.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
  upscaledLayer.appendChild(upscaledCanvas);

  // Original image (overlay, clipped from the right, revealed on right side)
  const originalLayer = document.createElement('div');
  originalLayer.className = 'comparison-original';
  originalLayer.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    clip-path: inset(0 0 0 50%);
  `;
  const originalCanvas = document.createElement('canvas');
  originalCanvas.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
  originalLayer.appendChild(originalCanvas);

  // Slider handle
  const handle = document.createElement('div');
  handle.className = 'comparison-handle';
  handle.style.cssText = `
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 4px;
    background: var(--accent);
    transform: translateX(-50%);
    cursor: ew-resize;
    z-index: 10;
    box-shadow: 0 0 8px rgba(0,0,0,0.5);
  `;

  // Handle grip circle
  const handleGrip = document.createElement('div');
  handleGrip.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    background: var(--accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  handleGrip.innerHTML = '⬌';
  handle.appendChild(handleGrip);

  // Labels
  const labelLeft = document.createElement('div');
  labelLeft.textContent = 'UPSCALED';
  labelLeft.style.cssText = `
    position: absolute;
    bottom: 12px;
    left: 12px;
    background: rgba(0,0,0,0.7);
    color: #fff;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    pointer-events: none;
    z-index: 5;
  `;

  const labelRight = document.createElement('div');
  labelRight.textContent = 'ORIGINAL';
  labelRight.style.cssText = `
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: rgba(0,0,0,0.7);
    color: #fff;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    pointer-events: none;
    z-index: 5;
  `;

  container.appendChild(upscaledLayer);
  container.appendChild(originalLayer);
  container.appendChild(handle);
  container.appendChild(labelLeft);
  container.appendChild(labelRight);
  resultWrapper.appendChild(container);

  // Draw images onto canvases
  upscaledCanvas.width = state.resultCanvas.width;
  upscaledCanvas.height = state.resultCanvas.height;
  upscaledCanvas.getContext('2d').drawImage(state.resultCanvas, 0, 0);

  originalCanvas.width = state.resultCanvas.width;
  originalCanvas.height = state.resultCanvas.height;
  originalCanvas.getContext('2d').drawImage(
    state.originalCanvas,
    0, 0, state.originalCanvas.width, state.originalCanvas.height,
    0, 0, originalCanvas.width, originalCanvas.height
  );

  // Slider interaction
  const updateSlider = (clientX) => {
    const rect = container.getBoundingClientRect();
    const pos = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

    // Update clip-path: inset(top right bottom left)
    // Slider at 50%: original shows right 50% (clip left 50%)
    // Slider at 0%: original shows 100% (clip left 0%)
    // Slider at 100%: original shows 0% (clip left 100%)
    originalLayer.style.clipPath = `inset(0 0 0 ${pos}%)`;
    handle.style.left = `${pos}%`;
    state.comparison.position = pos;
  };

  let isDragging = false;

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    updateSlider(e.clientX);
  });

  container.addEventListener('mousemove', (e) => {
    if (isDragging) {
      updateSlider(e.clientX);
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  container.addEventListener('touchstart', (e) => {
    isDragging = true;
    updateSlider(e.touches[0].clientX);
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (isDragging) {
      e.preventDefault();
      updateSlider(e.touches[0].clientX);
    }
  }, { passive: false });

  container.addEventListener('touchend', () => {
    isDragging = false;
  });

  // Initial position at 50%
  updateSlider(container.getBoundingClientRect().left + container.getBoundingClientRect().width * 0.5);
}

/**
 * Select a service
 */
async function selectService(serviceId) {
  // Update nav UI
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.service === serviceId);
  });

  state.currentService = SERVICES[serviceId];
  state.processor = null; // Will lazy load when processing

  // Render service-specific controls
  renderControls(serviceId);

  // Handle Chat Service Special Case
  if (serviceId === 'chat') {
    elements.uploadArea.classList.add('hidden');
    document.querySelector('.actions')?.classList.add('hidden');
    setupChatUI();
    return;
  } else {
    // If leaving chat or background removal, release memory
    if (state.processor && (state.currentService?.id === 'chat' || state.currentService?.id === 'background-removal')) {
      console.log(`[Main] Leaving ${state.currentService?.id}, clearing processor...`);
      state.processor.clear?.();
      state.processor.dispose?.();
      state.chatLoaded = false;
    }
    document.querySelector('.actions')?.classList.remove('hidden');
    removeChatUI();
  }

  // Hide SAM overlay if not in object-segmentation mode
  if (serviceId !== 'object-segmentation') {
    elements.samOverlay?.classList.add('hidden');
    if (elements.samOverlay) {
      elements.samOverlay.style.display = 'none';
    }
  }

  // Reset result if we have an image
  if (state.originalCanvas) {
    elements.resultPlaceholder.classList.remove('hidden');
    elements.btnDownload.disabled = true;
  }
}

/**
 * Render service-specific controls
 */
function renderControls(serviceId) {
  const controls = elements.controls;
  controls.innerHTML = '';

  switch (serviceId) {
    case 'background-removal': {
      controls.innerHTML = `
        <div class="control-group">
          <label class="control-label">Model Selection</label>
          <select id="bg-model" class="control-select">
            <option value="modnet">RMBG Fast (modnet)</option>
            <option value="inspyrenet">RMBG Ultra (InSPyReNet)</option>
            <option value="birefnet" selected>RMBG Pro (BiRefNet)</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">Output Format</label>
          <select id="bg-format" class="control-select">
            <option value="original" selected>Original (${state.originalFile.type.split('/')[1]?.toUpperCase() || 'JPEG'})</option>
            <option value="image/webp">WebP (Compressed)</option>
            <option value="image/png">PNG (Lossless)</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">Threshold (Sensitivity)</label>
          <div class="range-with-value">
            <input type="range" id="bg-threshold" class="control-input" value="0.5" min="0.1" max="0.9" step="0.05">
            <span class="range-value">0.5</span>
          </div>
        </div>
        <div class="control-group">
          <label class="control-label">Mask Threshold (Tightness)</label>
          <div class="range-with-value">
            <input type="range" id="bg-mask-threshold" class="control-input" value="0.5" min="0.1" max="0.9" step="0.05">
            <span class="range-value">0.5</span>
          </div>
        </div>
        <div class="control-group">
          <label class="control-label">Feathering (Edge Softness)</label>
          <div class="range-with-value">
            <input type="range" id="bg-feathering" class="control-input" value="0" min="0" max="10" step="1">
            <span class="range-value">0</span>
          </div>
        </div>

        <div class="divider" style="height: 1px; background: var(--border); margin: var(--space-md) 0; width: 100%;"></div>

        <div class="control-group">
          <label class="control-label">Manual Refinement</label>
          <div class="tool-buttons" style="display: flex; gap: var(--space-sm);">
            <button id="tool-none" class="btn btn-secondary tool-btn active" title="Select Tool">None</button>
            <button id="tool-erase" class="btn btn-secondary tool-btn" title="Erase Background">Erase</button>
            <button id="tool-restore" class="btn btn-secondary tool-btn" title="Restore Image">Restore</button>
          </div>
        </div>
        <div id="brush-size-group" class="control-group hidden">
          <label class="control-label">Brush Size</label>
          <div class="range-with-value">
            <input type="range" id="bg-brush-size" class="control-input" value="30" min="5" max="150" step="5">
            <span class="range-value">30</span>
          </div>
        </div>
      `;

      // Update range values dynamically and refine
      const refineDebounced = debounce(async () => {
        if (!state.resultCanvas || !state.processor || state.isProcessing) return;
        const options = getControlValues();
        try {
            const refined = await state.processor.refine(options);
            state.resultCanvas = refined;
            initManualMask(state.resultCanvas);
            updateResultDisplay();
        } catch (err) {
            console.error('Refinement failed:', err);
        }
      }, 150);

      controls.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
          e.target.nextElementSibling.textContent = e.target.value;

          if (e.target.id === 'bg-brush-size') {
            state.editing.brushSize = parseInt(e.target.value);
            return;
          }

          // Trigger refinement for threshold and feathering
          if (['bg-threshold', 'bg-mask-threshold', 'bg-feathering'].includes(e.target.id)) {
            refineDebounced();
          }
        });
      });

      // Tool selection logic
      const toolBtns = controls.querySelectorAll('.tool-btn');
      toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          toolBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const toolId = btn.id.replace('tool-', '');
          state.editing.activeTool = toolId;

          const brushSizeGroup = document.getElementById('brush-size-group');
          if (toolId === 'none') {
            brushSizeGroup?.classList.add('hidden');
            hideEditOverlay();
          } else {
            brushSizeGroup?.classList.remove('hidden');
            showEditOverlay();
          }
        });
      });

      // No SAM-specific logic needed anymore
      break;
    }

    case 'compression':
      controls.innerHTML = `
        <div class="control-group">
          <label class="control-label">Quality</label>
          <select id="compression-quality" class="control-select">
            <option value="0.9">High (90%)</option>
            <option value="0.8" selected>Medium (80%)</option>
            <option value="0.6">Low (60%)</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">Max Size (MB)</label>
          <input type="number" id="compression-maxsize" class="control-input" value="1" min="0.1" max="10" step="0.1">
        </div>
      `;
      break;

    case 'file-conversion':
      controls.innerHTML = `
        <div class="control-group">
          <label class="control-label">Output Format</label>
          <select id="conversion-format" class="control-select">
            <option value="image/png">PNG</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp" selected>WebP</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">Quality</label>
          <input type="range" id="conversion-quality" class="control-input" value="92" min="1" max="100">
        </div>
      `;
      break;

    case 'upscaling':
      controls.innerHTML = `
        <div class="control-group">
          <label class="control-label">Model</label>
          <select id="upscale-model" class="control-select">
            <option value="default" selected>Real-ESRGAN (4x Balanced)</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">Output Scale</label>
          <select id="upscale-factor" class="control-select">
            <option value="1.5">1.5x (Super Turbo - Ultra Fast)</option>
            <option value="2" selected>2x (Faster / Smaller File)</option>
            <option value="3">3x</option>
            <option value="4">4x (Original Resolution)</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">Target File Size (MB)</label>
          <div class="range-with-value">
            <input type="number" id="upscale-target-mb" class="control-input" value="10" min="0.5" max="50" step="0.5" style="width: 80px;">
            <span class="range-value" style="font-size: 11px; width: auto;">Max MB (0 for auto)</span>
          </div>
        </div>

        <div class="divider" style="height: 1px; background: var(--border); margin: var(--space-md) 0; width: 100%;"></div>

        <div class="control-group">
          <label class="control-label">Details</label>
          <div class="range-with-value">
            <input type="range" id="upscale-details" class="control-input" value="0.5" min="0" max="2" step="0.1">
            <span class="range-value">0.5</span>
          </div>
          <p style="color: var(--text-muted); font-size: 10px; margin-top: 4px;">
            Sharpening for micro-details (0 = pure AI, 1 = max sharpness)
          </p>
        </div>
        <div class="control-group">
          <label class="control-label">Brightness</label>
          <div class="range-with-value">
            <input type="range" id="upscale-brightness" class="control-input" value="0" min="-0.3" max="0.3" step="0.05">
            <span class="range-value">0</span>
          </div>
        </div>
        <div class="control-group">
          <label class="control-label">Saturation</label>
          <div class="range-with-value">
            <input type="range" id="upscale-saturation" class="control-input" value="0" min="-0.3" max="0.3" step="0.05">
            <span class="range-value">0</span>
          </div>
        </div>

        <p style="color: var(--text-muted); font-size: 11px; margin-top: 8px;">
          Using 4x Real-ESRGAN with high-quality downsampling.
        </p>
      `;

      // Update range values dynamically
      controls.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
          e.target.nextElementSibling.textContent = e.target.value;
        });
      });
      break;

    case 'blur':
      controls.innerHTML = `
        <div class="control-group">
          <label class="control-label">Model</label>
          <select id="blur-model" class="control-select">
            <option value="nano" selected>YOLO26 Nano (~5MB, Fastest)</option>
            <option value="small">YOLO26 Small (~10MB)</option>
            <option value="medium">YOLO26 Medium (~25MB)</option>
            <option value="large">YOLO26 Large (~50MB)</option>
            <option value="xlarge">YOLO26 XLarge (~100MB, Best)</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">Blur Amount (Strength)</label>
          <div class="range-with-value">
            <input type="range" id="blur-amount" class="control-input" value="20" min="5" max="80" step="5">
            <span class="range-value">20</span>
          </div>
        </div>

        <div class="divider" style="height: 1px; background: var(--border); margin: var(--space-md) 0; width: 100%;"></div>

        <div class="control-group">
          <label class="control-label">Surgical Radius (Scale)</label>
          <div class="range-with-value">
            <input type="range" id="blur-radius-scale" class="control-input" value="1.0" min="0.2" max="2.5" step="0.1">
            <span class="range-value">1.0</span>
          </div>
        </div>

        <div class="control-group">
          <label class="control-label">Blur Shape (Ellipse)</label>
          <div class="range-with-value">
            <input type="range" id="blur-shape" class="control-input" value="1.0" min="0.5" max="2.5" step="0.1">
            <span class="range-value">1.0</span>
          </div>
        </div>

        <div class="control-group">
          <label class="control-label">Edge Feathering</label>
          <div class="range-with-value">
            <input type="range" id="blur-feathering" class="control-input" value="0.75" min="0.1" max="0.95" step="0.05">
            <span class="range-value">0.75</span>
          </div>
        </div>

        <p style="color: var(--text-muted); font-size: 11px; margin-top: 8px;">
          Adjust sliders after processing for real-time fine-tuning.
        </p>
      `;

      // Fast re-blur debounce
      const updateBlurDebounced = debounce(async () => {
        if (!state.resultCanvas || !state.processor || state.isProcessing || state.currentService?.id !== 'blur') return;
        const options = getControlValues();
        try {
            const { canvas } = await state.processor.updateBlurTransform(options);
            state.resultCanvas = canvas;
            updateResultDisplay();
        } catch (err) {
            console.error('Fast re-blur failed:', err);
        }
      }, 50); // Very fast for sliders

      controls.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
          e.target.nextElementSibling.textContent = e.target.value;

          if (['blur-amount', 'blur-radius-scale', 'blur-feathering', 'blur-shape'].includes(e.target.id)) {
            updateBlurDebounced();
          }
        });
      });
      break;

    case 'object-segmentation': {
      controls.innerHTML = `
        <div class="control-group">
          <label class="control-label">Intelligence Mode</label>
          <select id="sam-model-id" class="control-select">
            <option value="Xenova/slimsam-77-uniform" selected>SlimSAM (Fastest)</option>
            <option value="onnx-community/sam2.1-hiera-tiny-ONNX">SAM-2 Tiny (Ultra-Precise)</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">Processing Mode</label>
          <div class="mode-toggle-group" style="display: flex; gap: var(--space-xs); background: var(--bg-secondary); padding: 4px; border-radius: var(--radius-md);">
            <button class="mode-btn active" data-mode="extract" style="flex: 1; padding: var(--space-xs) var(--space-sm); border-radius: var(--radius-sm); border: none; background: var(--accent); color: white; cursor: pointer; font-size: 11px; font-weight: 600;">Extract</button>
            <button class="mode-btn" data-mode="remove" style="flex: 1; padding: var(--space-xs) var(--space-sm); border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 11px; font-weight: 600;">Remove</button>
          </div>
        </div>
        <div class="control-group">
          <label class="control-label">Marker Type</label>
          <div class="point-selector-group" style="display: flex; gap: var(--space-md); background: var(--bg-secondary); padding: 8px; border-radius: var(--radius-md); justify-content: center;">
            <button class="point-type-btn active" data-label="1" title="Add Object (Positive)" style="width: 28px; height: 28px; border-radius: 50%; border: 3px solid #4ade80; background: #4ade80; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 0 0 2px var(--bg-secondary);">
              <div style="width: 100%; height: 100%; border-radius: 50%; background: #4ade80; border: 2px solid white;"></div>
            </button>
            <button class="point-type-btn" data-label="0" title="Exclude Area (Negative)" style="width: 28px; height: 28px; border-radius: 50%; border: 3px solid transparent; background: #ef4444; cursor: pointer; transition: transform 0.2s; box-shadow: 0.2s;">
              <div style="width: 100%; height: 100%; border-radius: 50%; background: #ef4444; border: 2px solid white;"></div>
            </button>
          </div>
        </div>
        <div class="control-group">
          <p class="control-hint" style="font-size: 11px; color: var(--text-muted); margin-top: var(--space-sm);">
            1. Select Marker Type (Green=Add, Red=Exclude).<br>
            2. Click on the image to select elements.<br>
            3. Use Shift+Click to add multiple markers.<br>
            4. Click "Process" to see 3 variations.
          </p>
          <button id="btn-clear-points" class="btn btn-secondary btn-sm" style="width: 100%; margin-top: var(--space-sm); font-size: 11px;">Clear Points</button>
        </div>

        <div class="divider" style="height: 1px; background: var(--border); margin: var(--space-md) 0; width: 100%;"></div>

        <div class="control-group">
          <label class="control-label">Manual Refinement</label>
          <div class="tool-buttons" style="display: flex; gap: var(--space-sm);">
            <button id="tool-none" class="btn btn-secondary tool-btn active" title="Select Tool">None</button>
            <button id="tool-erase" class="btn btn-secondary tool-btn" title="Erase Result">Erase</button>
            <button id="tool-restore" class="btn btn-secondary tool-btn" title="Restore Image">Restore</button>
          </div>
        </div>
        <div id="brush-size-group" class="control-group hidden">
          <label class="control-label">Brush Size</label>
          <div class="range-with-value">
            <input type="range" id="sam-brush-size" class="control-input" value="30" min="5" max="150" step="5">
            <span class="range-value">30</span>
          </div>
        </div>
      `;

      state.editing.activeMode = 'extract';
      state.editing.activeTool = 'none';

      // Point type toggles
      const pointTypeBtns = controls.querySelectorAll('.point-type-btn');
      pointTypeBtns.forEach(btn => {
        btn.onclick = () => {
          pointTypeBtns.forEach(b => {
             b.classList.remove('active');
             b.style.borderColor = 'transparent';
             b.style.transform = 'scale(1)';
          });
          btn.classList.add('active');
          const label = parseInt(btn.dataset.label);
          state.samPointLabel = label;
          btn.style.borderColor = label === 1 ? '#4ade80' : '#ef4444';
          btn.style.transform = 'scale(1.15)';
        };
      });

      // Mode toggles
      const modeBtns = controls.querySelectorAll('.mode-btn');
      modeBtns.forEach(btn => {
        btn.onclick = () => {
          modeBtns.forEach(b => {
             b.classList.remove('active');
             b.style.background = 'transparent';
             b.style.color = 'var(--text-secondary)';
          });
          btn.classList.add('active');
          btn.style.background = 'var(--accent)';
          btn.style.color = 'white';
          state.editing.activeMode = btn.dataset.mode;
        };
      });

      // Clear points
      document.getElementById('btn-clear-points').onclick = clearSAMPoints;

      // Tool selection logic (Erase/Restore)
      const toolBtns = controls.querySelectorAll('.tool-btn');
      toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          toolBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const toolId = btn.id.replace('tool-', '');
          state.editing.activeTool = toolId;

          const brushSizeGroup = document.getElementById('brush-size-group');
          if (toolId === 'none') {
            brushSizeGroup?.classList.add('hidden');
            hideEditOverlay();
          } else {
            brushSizeGroup?.classList.remove('hidden');
            showEditOverlay();
          }
        });
      });

      // Brush size sync
      const brushInput = document.getElementById('sam-brush-size');
      if (brushInput) {
        brushInput.addEventListener('input', (e) => {
          const val = e.target.value;
          e.target.nextElementSibling.textContent = val;
          state.editing.brushSize = parseInt(val);
        });
      }

      // Ensure overlay is visible
      if (serviceId === 'object-segmentation') {
        elements.samOverlay?.classList.remove('hidden');
        if (elements.samOverlay) {
          elements.samOverlay.style.display = 'block';
          setTimeout(syncSAMOverlay, 0); // Ensure layout is computed
        }
      }
      break;
    }

    case 'line-art':
      controls.innerHTML = `
        <div class="control-group">
          <label class="control-label">Edge Sensitivity (Threshold)</label>
          <div class="range-with-value">
            <input type="range" id="lineart-threshold" class="control-input" value="50" min="10" max="250" step="10">
            <span class="range-value">50</span>
          </div>
          <p style="color: var(--text-muted); font-size: 11px; margin-top: 8px;">
            Lower values detect more edges. Higher values result in cleaner, sparser lines.
          </p>
        </div>
      `;

      controls.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
          e.target.nextElementSibling.textContent = e.target.value;
        });
      });
      break;

    case 'chat':
      controls.innerHTML = `
        <p class="control-label">One-on-One Chat</p>
        <p class="control-hint">
          Model: LiquidAI/LFM2.5-1.2B (WebGPU)<br>
          Runs locally in your browser.
        </p>
      `;
      break;

    default:
      controls.innerHTML = `
        <p style="color: var(--text-secondary);">${state.currentService.description}</p>
      `;
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Upload area click
  elements.uploadArea.addEventListener('click', () => elements.fileInput.click());

  // File input change
  elements.fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  elements.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.add('drag-over');
  });

  elements.uploadArea.addEventListener('dragleave', () => {
    elements.uploadArea.classList.remove('drag-over');
  });

  elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  });

  // Action buttons
  elements.btnNew.addEventListener('click', resetWorkspace);
  elements.btnProcess.addEventListener('click', processImage);
  elements.btnDownload.addEventListener('click', downloadResult);

  // Result Canvas interaction for Edit Mode
  elements.resultCanvas.addEventListener('mousedown', (e) => handleEdit(e, 'start'));
  elements.resultCanvas.addEventListener('mousemove', (e) => handleEdit(e, 'move'));
  elements.resultCanvas.addEventListener('mouseenter', (e) => handleEdit(e, 'enter'));
  elements.resultCanvas.addEventListener('mouseleave', (e) => handleEdit(e, 'leave'));
  window.addEventListener('mouseup', () => handleEdit(null, 'end'));
}

/**
 * Handle file selection
 */
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) handleFile(file);
}

/**
 * Handle uploaded file
 */
async function handleFile(file) {
  // Check file size (5MB limit)
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    showToast('File too large (max 5MB)', 'error');
    return;
  }

  state.originalFile = {
    name: file.name,
    type: file.type,
  };
  try {
    const img = await loadImage(file);
    state.originalImage = img;

    // Draw to original canvas
    const { canvas } = imageToCanvas(img);
    state.originalCanvas = canvas;

    // Display
    const domCanvas = elements.originalCanvas;
    domCanvas.width = canvas.width;
    domCanvas.height = canvas.height;
    domCanvas.getContext('2d').drawImage(canvas, 0, 0);

    syncSAMOverlay();

    // Show workspace
    elements.uploadArea.classList.add('hidden');
    elements.workspace.classList.remove('hidden');
    elements.resultPlaceholder.classList.remove('hidden');
    elements.btnDownload.disabled = true;

    // Reset state for new image
    state.resultLayers = [];
    state.selectedLayerIndex = -1;
    elements.layersContainer.innerHTML = '';
    elements.layerPicker.classList.add('hidden');

    // Reset manual mask
    state.editing.manualMaskCanvas = null;
    hideEditOverlay();

    // Clear worker memory for the new image
    if (state.processor?.clear) {
      state.processor.clear();
    }

    // Refresh controls
    renderControls(state.currentService.id);

  } catch (err) {
    showToast('Failed to load image', 'error');
    console.error(err);
  }
}

/**
 * Reset workspace to initial state
 */
function resetWorkspace() {
  state.originalImage = null;
  state.originalCanvas = null;
  state.resultCanvas = null;
  state.resultLayers = [];
  state.selectedLayerIndex = -1;
  elements.layersContainer.innerHTML = '';
  elements.layerPicker.classList.add('hidden');
  state.editing.manualMaskCanvas = null;
  hideEditOverlay();

  elements.workspace.classList.add('hidden');

  if (state.currentService?.id !== 'chat') {
    elements.uploadArea.classList.remove('hidden');
  }

  elements.fileInput.value = '';
  elements.statusBar.classList.add('hidden');

  const chatOutput = document.getElementById('chat-output');
  if (chatOutput) chatOutput.innerHTML = '';
}

/**
 * Process the image with current service
 */
async function processImage() {
  if (!state.originalCanvas || state.isProcessing) return;

  state.isProcessing = true;
  elements.btnProcess.disabled = true;
  elements.btnProcess.innerHTML = '<span class="spinner"></span> Processing...';
  elements.statusBar.classList.remove('hidden');

  try {
    if (state.currentService.id === 'object-segmentation') {
      console.log('[Main] Routing to smartSelect...');
      await smartSelect();
      return;
    }

    if (!state.processor) {
      updateProgress(elements.statusBar, 0.1, 'Loading model...');
      state.processor = await loadProcessor(state.currentService.id);
    }

    const options = getControlValues();

    if (state.currentService.id === 'background-removal' && options.model === 'sam2') {
      updateProgress(elements.statusBar, 0.4, 'Encoding image...');
      await state.processor.encode(state.originalCanvas, (progress, message) => {
        updateProgress(elements.statusBar, 0.4 + progress * 0.6, message);
      });

      updateProgress(elements.statusBar, 1.0, 'Ready! Refine with clicks.');
      showToast('Smart select ready! Use Rectangle or click to extract.', 'info');
      state.resultCanvas = null;
      return;
    }

    updateProgress(elements.statusBar, 0.3, 'Processing image...');
    const result = await state.processor.process(state.originalCanvas, options, (progress, message) => {
      updateProgress(elements.statusBar, 0.3 + progress * 0.6, message);
    });

    // Handle different result formats
    // Blur service returns { canvas, detections, count }, others return canvas directly
    if (state.currentService.id === 'blur') {
      state.resultCanvas = result.canvas;
      showToast(`Blurred ${result.count} face(s)`, 'info');
    } else {
      state.resultCanvas = result;
    }
    initManualMask(state.resultCanvas);

    if (state.currentService.id === 'upscaling') {
      setupComparisonSlider();
    } else {
      updateResultDisplay();
    }

    updateProgress(elements.statusBar, 1, 'Complete!');
    showToast('Processing complete!', 'success');

  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
    console.error(err);
    updateProgress(elements.statusBar, 0, 'Error occurred');
  } finally {
    state.isProcessing = false;
    elements.btnProcess.disabled = false;
    elements.btnProcess.textContent = 'Process';
    elements.statusBar.classList.add('hidden');
  }
}

async function smartSelect() {
  console.log('[Main] smartSelect triggered', { points: state.samPoints.length, service: state.currentService.id });
  if (!state.originalCanvas || state.samPoints.length === 0) {
    console.warn('[Main] smartSelect aborted: missing canvas or points');
    return;
  }

  const modelId = document.getElementById('sam-model-id')?.value || 'Xenova/slimsam-77-uniform';

  const options = {
    modelId,
    points: state.samPoints.map(p => ({
      x: p.x, // Normalized (0..1)
      y: p.y, // Normalized (0..1)
      label: p.label
    })),
    mode: state.editing.activeMode || 'extract'
  };

  try {
    // We leverage the isProcessing already set by processImage()
    // but we update the UI to be more specific
    elements.btnProcess.innerHTML = '<span class="spinner"></span> Selecting...';

    if (!state.processor) {
      state.processor = await loadProcessor('object-segmentation');
    }

    console.log('[Main] smartSelect calling processor.process...');
    const results = await state.processor.process(state.originalCanvas, options, (progress, message) => {
      updateProgress(elements.statusBar, progress, message);
    });

    console.log('[Main] smartSelect results received', { count: results.options.length });
    handleObjectResults(results);

  } catch (err) {
    console.error('[Main] smartSelect ERROR:', err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    state.isProcessing = false;
    elements.btnProcess.disabled = false;
    elements.btnProcess.textContent = 'Process';
    elements.statusBar.classList.add('hidden');
  }
}
function handleObjectResults(result) {
  const { options } = result;

  // Update primary display with first option as default
  initManualMask(options[0]);
  updateResultDisplay();

  // Show Option Picker
  elements.layerPicker.classList.remove('hidden');
  elements.layersContainer.innerHTML = '';

  options.forEach((canvas, idx) => {
    const card = document.createElement('div');
    card.className = 'layer-card' + (idx === 0 ? ' active' : '');
    card.style.cssText = `
      flex: 0 0 120px;
      height: 120px;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      overflow: hidden;
      cursor: pointer;
      border: 2px solid ${idx === 0 ? 'var(--accent)' : 'transparent'};
      position: relative;
    `;

    // Scale canvas to fit thumbnail
    const thumb = document.createElement('canvas');
    thumb.width = 120;
    thumb.height = 120;
    const tCtx = thumb.getContext('2d');

    // Draw original background if thumb is transparent and in extract mode
    if (state.editing.activeMode === 'extract') {
       tCtx.fillStyle = '#eee'; // Checkerboard placeholder
       tCtx.fillRect(0,0,120,120);
    }

    tCtx.drawImage(canvas, 0, 0, 120, 120);
    card.appendChild(thumb);

    const label = document.createElement('div');
    label.textContent = `Option ${idx + 1}`;
    label.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.5); color: white; font-size: 10px; text-align: center; padding: 2px;';
    card.appendChild(label);

    card.onclick = () => {
      elements.layersContainer.querySelectorAll('.layer-card').forEach(c => {
         c.classList.remove('active');
         c.style.borderColor = 'transparent';
      });
      card.classList.add('active');
      card.style.borderColor = 'var(--accent)';
      initManualMask(canvas);
      updateResultDisplay();
    };

    elements.layersContainer.appendChild(card);
  });
}
function updateSAMMarkers() {
  if (!elements.samOverlay) return;

  // Clear existing markers except the rect
  const existingPoints = elements.samOverlay.querySelectorAll('.sam-point');
  existingPoints.forEach(p => p.remove());

  state.samPoints.forEach(point => {
    const dot = document.createElement('div');
    dot.className = 'sam-point';
    const color = point.label === 1 ? '#4ade80' : '#ef4444'; // Green for pos, Red for neg
    dot.style.cssText = `
      position: absolute;
      left: ${point.x * 100}%;
      top: ${point.y * 100}%;
      width: 12px;
      height: 12px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 4px rgba(0,0,0,0.5);
      pointer-events: none;
    `;
    elements.samOverlay.appendChild(dot);
  });
}

function clearSAMPoints() {
  state.samPoints = [];
  updateSAMMarkers();
  if (elements.layersContainer) elements.layersContainer.innerHTML = '';
  elements.layerPicker?.classList.add('hidden');
}

/**
 * Load processor module for a service
 */
async function loadProcessor(serviceId) {
  const module = await import(`./services/${serviceId}/processor.js`);
  return module.default || module;
}

/**
 * Get values from service-specific controls
 */
function getControlValues() {
  const options = {};

  switch (state.currentService.id) {
    case 'background-removal':
      options.model = document.getElementById('bg-model')?.value || 'modnet';
      options.format = document.getElementById('bg-format')?.value || 'original';
      options.threshold = parseFloat(document.getElementById('bg-threshold')?.value || 0.5);
      options.maskThreshold = parseFloat(document.getElementById('bg-mask-threshold')?.value || 0.5);
      options.feathering = parseInt(document.getElementById('bg-feathering')?.value || 0);
      break;

    case 'compression':
      options.quality = parseFloat(document.getElementById('compression-quality')?.value || 0.8);
      options.maxSizeMB = parseFloat(document.getElementById('compression-maxsize')?.value || 1);
      break;

    case 'file-conversion':
      options.format = document.getElementById('conversion-format')?.value || 'image/webp';
      options.quality = parseInt(document.getElementById('conversion-quality')?.value || 92) / 100;
      break;

    case 'upscaling':
      options.model = document.getElementById('upscale-model')?.value || 'default';
      options.scale = parseFloat(document.getElementById('upscale-factor')?.value || 4);
      options.targetMB = parseFloat(document.getElementById('upscale-target-mb')?.value || 0);
      options.detailsIntensity = parseFloat(document.getElementById('upscale-details')?.value || 0.5);
      options.brightness = parseFloat(document.getElementById('upscale-brightness')?.value || 0);
      options.saturation = parseFloat(document.getElementById('upscale-saturation')?.value || 0);
      break;

    case 'blur':
      options.variant = document.getElementById('blur-model')?.value || 'nano';
      options.blurAmount = parseInt(document.getElementById('blur-amount')?.value || 20);
      options.radiusScale = parseFloat(document.getElementById('blur-radius-scale')?.value || 1.0);
      options.shape = parseFloat(document.getElementById('blur-shape')?.value || 1.0);
      options.feathering = parseFloat(document.getElementById('blur-feathering')?.value || 0.75);
      break;

    case 'line-art':
      options.threshold = parseInt(document.getElementById('lineart-threshold')?.value || 50);
      break;
  }

  return options;
}

/**
 * Download result image
 */
async function downloadResult() {
  if (!state.resultCanvas) return;

  const service = state.currentService.id;
  const options = getControlValues();
  let format = 'image/png';
  let ext = 'png';

  if (service === 'background-removal') {
    format = options.format;
    if (format === 'original') {
      format = state.originalFile.type || 'image/png';
    }
    if (format === 'image/jpg') format = 'image/jpeg';
    ext = format.split('/')[1] || 'png';
  }

  const baseName = state.originalFile.name ?
    state.originalFile.name.replace(/\.[^/.]+$/, "") :
    'processed';

  const suffixMap = {
    'upscaling': 'upscaled',
    'background-removal': 'nobg',
    'blur': 'blurred',
    'compression': 'compressed',
    'line-art': 'lineart',
    'object-segmentation': 'selected',
    'file-conversion': 'converted'
  };

  const suffix = suffixMap[service] || 'processed';
  const filename = `${baseName}-${suffix}.${ext}`;

  try {
    let finalBlob = null;
    let finalQuality = 0.92;

    // Handle target file size for upscaling
    if (service === 'upscaling' && options.targetMB > 0) {
      const targetBytes = options.targetMB * 1024 * 1024;
      format = 'image/jpeg';
      ext = 'jpg';

      showToast(`Optimizing for ${options.targetMB}MB...`, 'info');

      // Binary search or iterative approach for quality
      let minQ = 0.1;
      let maxQ = 1.0;

      for (let i = 0; i < 6; i++) { // 6 iterations to find good quality
        finalQuality = (minQ + maxQ) / 2;
        finalBlob = await canvasToBlob(state.resultCanvas, format, finalQuality);

        if (finalBlob.size > targetBytes) {
          maxQ = finalQuality;
        } else {
          minQ = finalQuality;
          if (finalBlob.size > targetBytes * 0.9) break; // Close enough
        }
      }

      showToast(`Final size: ${(finalBlob.size / (1024 * 1024)).toFixed(2)}MB`, 'success');
    } else {
      finalBlob = await canvasToBlob(state.resultCanvas, format, finalQuality);
    }

    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.substring(0, filename.lastIndexOf('.')) + '.' + ext;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Download started!', 'success');
  } catch (err) {
    console.error('Download failed:', err);
    showToast('Download failed', 'error');
  }
}

// Initialize on load
init();

// --- Chat UI Helpers ---

function setupChatUI() {
  resetWorkspace();
  elements.uploadArea.classList.add('hidden');
  elements.workspace.classList.remove('hidden');

  let chatContainer = document.getElementById('chat-container');
  if (!chatContainer) {
    chatContainer = document.createElement('div');
    chatContainer.id = 'chat-container';
    chatContainer.className = 'chat-container';
    chatContainer.innerHTML = `
      <div id="chat-output" class="chat-output">
        <div class="message system">👋 Ready to chat!</div>
      </div>
      <div class="chat-input-area">
        <textarea id="chat-input" class="chat-input" placeholder="Type your message..."></textarea>
        <button id="btn-chat-send" class="btn btn-primary">Send</button>
      </div>
    `;
    Array.from(elements.workspace.children).forEach(c => c.classList.add('hidden-during-chat'));
    elements.workspace.appendChild(chatContainer);
    document.getElementById('btn-chat-send').addEventListener('click', handleChatSend);
  } else {
    chatContainer.classList.remove('hidden');
  }
}

function removeChatUI() {
  document.getElementById('chat-container')?.classList.add('hidden');
}

async function handleChatSend() {
  // Chat logic remains here if needed
}

// --- Manual Editing Helpers ---

function initManualMask(aiResultCanvas) {
  const { width, height } = aiResultCanvas;
  if (!state.editing.manualMaskCanvas) {
    state.editing.manualMaskCanvas = document.createElement('canvas');
  }
  state.editing.manualMaskCanvas.width = width;
  state.editing.manualMaskCanvas.height = height;
  state.editing.manualMaskCtx = state.editing.manualMaskCanvas.getContext('2d');
  state.editing.manualMaskCtx.clearRect(0, 0, width, height);
  state.editing.manualMaskCtx.drawImage(aiResultCanvas, 0, 0);
  saveMaskState();
}

function saveMaskState() {
  const canvas = state.editing.manualMaskCanvas;
  if (!canvas) return;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
  state.editing.lastSavedMask = tempCanvas;
}

function updateResultDisplay() {
  const displayCanvas = elements.resultCanvas;
  const mask = state.editing.manualMaskCanvas;
  const original = state.originalCanvas;

  if (!mask || !original) return;

  displayCanvas.width = original.width;
  displayCanvas.height = original.height;
  const ctx = displayCanvas.getContext('2d');
  ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

  if (state.currentService.id === 'blur' || state.currentService.id === 'upscaling' || state.currentService.id === 'line-art' || state.currentService.id === 'object-segmentation') {
    // For blur/upscaling, the mask variable actually contains the full processed image
    ctx.drawImage(mask, 0, 0);
  } else {
    // For background removal, composite original with the transparency mask
    ctx.drawImage(original, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  elements.resultPlaceholder.classList.add('hidden');
  elements.btnDownload.disabled = false;
  state.resultCanvas = displayCanvas;
}

function handleEdit(e, type) {
  const tool = state.editing.activeTool;
  if (tool === 'none' || !state.editing.manualMaskCanvas) return;

  if (type === 'start') {
    state.editing.isDrawing = true;
    drawAt(e);
  } else if (type === 'move' && state.editing.isDrawing) {
    drawAt(e);
  } else if (type === 'end') {
    state.editing.isDrawing = false;
  }
}

function drawAt(e) {
  if (!e) return;
  const tool = state.editing.activeTool;
  const ctx = state.editing.manualMaskCtx;
  const canvas = elements.resultCanvas;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleX;
  const size = state.editing.brushSize * scaleX;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  if (tool === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
  } else if (tool === 'restore') {
    ctx.globalCompositeOperation = 'source-over';
    const pattern = ctx.createPattern(state.originalCanvas, 'no-repeat');
    ctx.fillStyle = pattern;
    ctx.fill();
  }
  ctx.restore();
  updateResultDisplay();
}

function showEditOverlay() {
  document.getElementById('edit-overlay')?.classList.remove('hidden');
}

function hideEditOverlay() {
  document.getElementById('edit-overlay')?.classList.add('hidden');
}
