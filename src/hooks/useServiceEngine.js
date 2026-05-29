import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, matchPath } from 'react-router-dom';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';

/**
 * Custom hook to manage the service lifecycle, including:
 * 1. Routing and active service detection.
 * 2. Worker activation and memory management.
 * 3. Results caching (snapshots) between service switches.
 */
export const useServiceEngine = (resultCanvas, setResultCanvas) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const match = matchPath("/services/:serviceId", pathname);

  // Source of truth for active service
  const serviceId = useMemo(() => match?.params?.serviceId || SERVICE_ORDER[0], [match]);

  const [serviceResults, setServiceResults] = useState({});

  const currentService = useMemo(() => {
    return SERVICES[serviceId] || SERVICES[SERVICE_ORDER[0]];
  }, [serviceId]);

  const selectService = useCallback((targetServiceId) => {
    navigate(`/services/${targetServiceId}`);
  }, [navigate]);

  // --- 1. Dedicated Worker Activation ---
  // Swaps AI models immediately when the route changes
  useEffect(() => {
    import('../core/worker-registry').then(({ workerRegistry }) => {
      workerRegistry.activate(serviceId);
    });
  }, [serviceId]);

  // --- 2. Snapshot & Hydration Logic ---
  // Uses the cleanup pattern to save state before switching
  useEffect(() => {
    // A. HYDRATE: If we have a cached result for this service, restore it
    const cached = serviceResults[serviceId];
    if (cached) {
      setResultCanvas(cached.resultCanvas);
    } else if (resultCanvas !== null) {
      // If no cache exists, clear the canvas (unless it was already clear)
      setResultCanvas(null);
    }

    // B. SNAPSHOT: Capture current state when leaving this service
    return () => {
      const leavingId = serviceId;
      const snapshot = { resultCanvas: resultRef.current };

      setServiceResults(prev => {
        // Optimization: Don't snapshot if there is nothing to save
        if (!snapshot.resultCanvas) return prev;

        const next = { ...prev, [leavingId]: snapshot };

        // C. MEMORY MANAGEMENT: Evict oldest result if cache exceeds 3 items
        const keys = Object.keys(next);
        if (keys.length > 3) {
          const oldestKey = keys[0];
          const oldestResult = next[oldestKey];

          if (oldestResult?.resultCanvas?.close) {
             oldestResult.resultCanvas.close();
          }
          delete next[oldestKey];
        }

        return next;
      });
    };
  }, [serviceId, setResultCanvas]);

  // --- 3. Result Tracker Ref ---
  // Keeps the "Snapshot" closure fresh without re-triggering the effect
  const resultRef = useRef(resultCanvas);
  useEffect(() => {
    resultRef.current = resultCanvas;
  }, [resultCanvas]);

  return {
    currentService,
    serviceId,
    serviceResults,
    setServiceResults,
    selectService
  };
};
