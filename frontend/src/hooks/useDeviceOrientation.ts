import { useState, useEffect, useCallback } from 'react';

interface DeviceOrientationData {
  alpha: number | null; // Z-axis rotation (0-360)
  beta: number | null;  // X-axis rotation (-180 to 180)
  gamma: number | null; // Y-axis rotation (-90 to 90)
  absolute?: boolean;   // True if providing absolute values
  compass?: number;     // Calculated compass heading
}

interface OrientationPermissionState {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

/**
 * iOS 13+ gates the orientation sensor behind a user-gesture permission call.
 * It is a vendor addition to the constructor, so it is absent from lib.dom.
 */
type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
};

/** Likewise absent from WindowEventMap, though Android fires it. */
const ABSOLUTE_ORIENTATION_EVENT = 'deviceorientationabsolute';

interface UseDeviceOrientationResult {
  orientation: DeviceOrientationData | null;
  error: string | null;
  isSupported: boolean;
  permission: OrientationPermissionState;
  requestPermission: () => Promise<boolean>;
}

export const useDeviceOrientation = (): UseDeviceOrientationResult => {
  const [orientation, setOrientation] = useState<DeviceOrientationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<OrientationPermissionState>({
    granted: false,
    denied: false,
    prompt: true
  });

  // Check for modern orientation support
  const isSupported = typeof DeviceOrientationEvent !== 'undefined' &&
    (typeof (DeviceOrientationEvent as DeviceOrientationEventWithPermission).requestPermission === 'function' ||
     'ondeviceorientationabsolute' in window);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Device orientation is not supported on this device');
      return false;
    }

    try {
      // For iOS 13+ devices, we need to request permission. Call it on the
      // constructor itself - detaching the method loses its receiver.
      const orientationEvent =
        DeviceOrientationEvent as DeviceOrientationEventWithPermission;
      if (typeof orientationEvent.requestPermission === 'function') {
        const permissionState = await orientationEvent.requestPermission();

        if (permissionState === 'granted') {
          setPermission({ granted: true, denied: false, prompt: false });
          setError(null);
          return true;
        } else {
          setPermission({ granted: false, denied: true, prompt: false });
          setError('Permission denied for device orientation');
          return false;
        }
      } else {
        // For Android and other devices, check if compass events are available
        setPermission({ granted: true, denied: false, prompt: false });
        setError(null);
        return true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request device orientation permission');
      setPermission({ granted: false, denied: true, prompt: false });
      return false;
    }
  }, [isSupported]);

  const calculateCompass = useCallback((alpha: number | null): number | undefined => {
    if (alpha === null) return undefined;
    
    // Convert alpha to compass heading (0° = North, 90° = East, etc.)
    let compass = 360 - alpha;
    if (compass >= 360) compass -= 360;
    if (compass < 0) compass += 360;
    
    return compass;
  }, []);

  useEffect(() => {
    if (!isSupported || !permission.granted) {
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      try {
        const { alpha, beta, gamma, absolute } = event;
        
        const orientationData: DeviceOrientationData = {
          alpha,
          beta,
          gamma,
          absolute,
          compass: calculateCompass(alpha)
        };

        setOrientation(orientationData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error reading device orientation');
      }
    };

    const handleOrientationAbsolute = (event: DeviceOrientationEvent) => {
      try {
        const { alpha, beta, gamma } = event;
        
        // For Android devices, use the absolute event when available
        const orientationData: DeviceOrientationData = {
          alpha,
          beta,
          gamma,
          absolute: true,
          compass: calculateCompass(alpha)
        };

        setOrientation(orientationData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error reading device orientation');
      }
    };

    // Try to use deviceorientationabsolute first (more reliable for compass)
    const hasAbsoluteEvent = 'ondeviceorientationabsolute' in window;
    
    if (hasAbsoluteEvent) {
      window.addEventListener(ABSOLUTE_ORIENTATION_EVENT, handleOrientationAbsolute as EventListener, true);
    } else {
      // Fallback to regular deviceorientation
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      if (hasAbsoluteEvent) {
        window.removeEventListener(ABSOLUTE_ORIENTATION_EVENT, handleOrientationAbsolute as EventListener, true);
      } else {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, [isSupported, permission.granted, calculateCompass]);

  return {
    orientation,
    error,
    isSupported,
    permission,
    requestPermission
  };
};
