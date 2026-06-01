import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, matchPath } from 'react-router-dom';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';

/**
 * Custom hook to manage the service lifecycle, including:
 * 1. Routing and active service detection.
 * 2. Navigation for the currently selected service.
 */
export const useServiceEngine = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const match = matchPath("/services/:serviceId", pathname);

  // Source of truth for active service
  const serviceId = useMemo(() => match?.params?.serviceId || SERVICE_ORDER[0], [match]);

  const currentService = useMemo(() => {
    return SERVICES[serviceId] || SERVICES[SERVICE_ORDER[0]];
  }, [serviceId]);

  const selectService = useCallback((targetServiceId) => {
    navigate(`/services/${targetServiceId}`);
  }, [navigate]);

  return {
    currentService,
    serviceId,
    selectService
  };
};
