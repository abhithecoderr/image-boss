
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
  const serviceId = match?.params?.serviceId || SERVICE_ORDER[0];

  const currentService = SERVICES[serviceId] || SERVICES[SERVICE_ORDER[0]];

  const selectService = (targetServiceId) => {
    navigate(`/services/${targetServiceId}`);
  };

  return {
    currentService,
    serviceId,
    selectService
  };
};
