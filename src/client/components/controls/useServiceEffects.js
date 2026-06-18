/*
 * Local React hooks managing sidebar size estimation and format conversions.
 */
import { useState, useEffect, useRef } from 'react';
import { useWorkspace, useService } from '../../store';
import { hasAlphaTransparency } from '../../utils/canvas-utils';

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
