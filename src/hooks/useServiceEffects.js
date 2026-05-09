import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAppEngine } from './useAppEngine';

/**
 * useServiceEffects — Headless hook that manages service-specific side effects
 * like compression estimation and background removal post-processing.
 * 
 * @param {string} serviceId 
 * @param {Object} options 
 * @param {Canvas} sourceCanvas 
 * @param {Canvas} resultCanvas 
 */
export const useServiceEffects = (serviceId, options, sourceCanvas, resultCanvas, onOptionChange) => {
  const { execute } = useAppEngine();
  
  // --- Compression Estimation ---
  const [estimatedSize, setEstimatedSize] = useState(null);
  const estimateDebounceRef = useRef(null);

  useEffect(() => {
    if (serviceId !== 'compression' || !sourceCanvas) {
      setEstimatedSize(null);
      return;
    }

    const quality = (options?.quality ?? 80) / 100;

    clearTimeout(estimateDebounceRef.current);
    estimateDebounceRef.current = setTimeout(() => {
      let mimeType = 'image/jpeg';
      try {
        const sampleCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
        if (sampleCtx && sampleCtx.getImageData(0, 0, 1, 1).data[3] < 255) {
          mimeType = 'image/webp';
        }
      } catch (e) {}
      
      sourceCanvas.toBlob(
        (blob) => { if (blob) setEstimatedSize(blob.size); },
        mimeType,
        quality
      );
    }, 400);

    return () => clearTimeout(estimateDebounceRef.current);
  }, [serviceId, options?.quality, sourceCanvas]);

  // --- Background Removal Post-Processing ---
  const postProcessDebounceRef = useRef(null);
  const lastProcessedOptionsRef = useRef(null);

  useEffect(() => {
    if (serviceId !== 'background-removal' || !sourceCanvas || !resultCanvas) return;

    // Check if relevant options actually changed
    const currentRelevant = {
      edgeShift: options?.edgeShift,
      edgeSmoothness: options?.edgeSmoothness,
      edgeContrast: options?.edgeContrast
    };

    // If we have a result but haven't tracked options yet, it means the result
    // is already synced with the current options (e.g., on mount or after manual run).
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

    clearTimeout(postProcessDebounceRef.current);
    postProcessDebounceRef.current = setTimeout(() => {
      execute({ ...options, _postProcess: true });
      lastProcessedOptionsRef.current = currentRelevant;
    }, 80);

    return () => clearTimeout(postProcessDebounceRef.current);
  }, [
    serviceId,
    options?.edgeShift,
    options?.edgeSmoothness,
    options?.edgeContrast,
    sourceCanvas,
    resultCanvas, // Added resultCanvas to dependencies to ensure we have it
    execute
  ]);

  // --- File Conversion Sync ---
  const { originalFile, updateServiceSetting } = useApp();
  useEffect(() => {
    if (serviceId !== 'file-conversion' || !originalFile) return;
    
    const mime = originalFile.type || 'application/octet-stream';
    if (options?.inputFormat !== mime) {
      if (onOptionChange) {
        onOptionChange('inputFormat', mime);
      } else {
        updateServiceSetting('file-conversion', 'inputFormat', mime);
      }
    }
  }, [serviceId, originalFile, options?.inputFormat, updateServiceSetting, onOptionChange]);

  return {
    estimatedSize
  };
};

