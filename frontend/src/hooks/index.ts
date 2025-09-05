// All hooks have been consolidated into AppContext
export { useAppContext } from './useAppContext';

// On-demand trail loading hook
export { useTrailDetails } from './useTrailDetails';

// Mobile responsive hooks
export { 
  useMediaQuery, 
  useIsMobile, 
  useIsTablet, 
  useIsDesktop, 
  useIsTouchDevice,
  useIsPortrait,
  useIsLandscape 
} from './useMediaQuery';

// Location and orientation hooks
export { useGeolocation } from './useGeolocation';
export { 
  useDeviceOrientation, 
  getCompassDirection, 
  getCompassArrow 
} from './useDeviceOrientation';