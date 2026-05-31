import { useState, useEffect, useRef } from 'react';
import { useWorkspace, useService } from '../context/AppContext';
import { useUnifiedProcessor } from './useUnifiedProcessor';
import { hasAlphaTransparency } from '../core/canvas-utils';

/* 
 useCompressionEstimator:
 Debounces canvas rendering to calculate real-time estimates of output compressed file sizes
 based on JPEG/WebP quality thresholds without writing intermediate files to disk.
*/
export const useCompressionEstimator = (options, sourceCanvas) => {
  const [estimatedSize, setEstimatedSize] = useState(null);
  const estimateDebounceRef = useRef(null);

  useEffect(() => {
    if (!sourceCanvas || !options) {
      setEstimatedSize(null);
      return;
    }

    const quality = (options?.quality ?? 80) / 100;

    // Throttle calculation frequency (400ms debounce) to maintain UI frame rates
    clearTimeout(estimateDebounceRef.current);
    estimateDebounceRef.current = setTimeout(() => {
      // Use WebP if image supports alpha transparency, fallback to JPEG
      const mimeType = hasAlphaTransparency(sourceCanvas) ? 'image/webp' : 'image/jpeg';

      sourceCanvas.toBlob(
        (blob) => { if (blob) setEstimatedSize(blob.size); },
        mimeType,
        quality
      );
    }, 400);

    return () => clearTimeout(estimateDebounceRef.current);
  }, [options?.quality, sourceCanvas]);

  return estimatedSize;
};

/* 
 useBgRemovalPostProcessor:
 Listens to slider adjustments (edge shifts, smooth filters, contrasts) and debounces
 post-processing passes to refine mask overlays smoothly.
*/
export const useBgRemovalPostProcessor = (options, sourceCanvas, resultCanvas) => {
  const { currentService } = useService();
  const { execute } = useUnifiedProcessor();
  const postProcessDebounceRef = useRef(null);
  const lastProcessedOptionsRef = useRef(null);

  // Track the latest service ID in a ref to prevent stale closure execution in timeouts
  const currentServiceIdRef = useRef(currentService?.id);
  useEffect(() => {
    currentServiceIdRef.current = currentService?.id;
  }, [currentService?.id]);

  useEffect(() => {
    if (currentService?.id !== 'background-removal') {
      lastProcessedOptionsRef.current = null;
      return;
    }
    if (!sourceCanvas || !resultCanvas || !options) return;

    // Check if relevant edge sliders actually shifted
    const currentRelevant = {
      edgeShift: options?.edgeShift,
      edgeSmoothness: options?.edgeSmoothness,
      edgeContrast: options?.edgeContrast
    };

    if (!lastProcessedOptionsRef.current) {
      lastProcessedOptionsRef.current = currentRelevant;
      return;
    }

    if (
      lastProcessedOptionsRef.current.edgeShift === currentRelevant.edgeShift &&
      lastProcessedOptionsRef.current.edgeSmoothness === currentRelevant.edgeSmoothness &&
      lastProcessedOptionsRef.current.edgeContrast === currentRelevant.edgeContrast
    ) {
      return;
    }

    // Debounce the edge refinement computations (80ms throttle) to keep slider dragging responsive
    clearTimeout(postProcessDebounceRef.current);
    postProcessDebounceRef.current = setTimeout(() => {
      // Guard: Ensure we are still on background removal when the debounce fires
      if (currentServiceIdRef.current === 'background-removal') {
        execute({ ...options, _postProcess: true });
      }
      lastProcessedOptionsRef.current = currentRelevant;
    }, 80);

    return () => clearTimeout(postProcessDebounceRef.current);
  }, [
    options?.edgeShift,
    options?.edgeSmoothness,
    options?.edgeContrast,
    sourceCanvas,
    resultCanvas,
    execute,
    currentService?.id,
    options
  ]);
};

/* 
 useFileConversionSync:
 Detects the MIME type of a newly uploaded file and automatically binds it
 as the "inputFormat" parameter in the file conversion context.
*/
export const useFileConversionSync = (options, onOptionChange) => {
  const { originalFile } = useWorkspace();
  const { updateServiceSetting } = useService();

  useEffect(() => {
    if (!originalFile || !options) return;

    const mime = originalFile.type || 'application/octet-stream';
    if (options?.inputFormat !== mime) {
      if (onOptionChange) {
        onOptionChange('inputFormat', mime);
      } else {
        updateServiceSetting('file-conversion', 'inputFormat', mime);
      }
    }
  }, [originalFile, options?.inputFormat, updateServiceSetting, onOptionChange]);
};
