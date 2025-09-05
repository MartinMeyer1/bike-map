import { useState, useEffect, useCallback } from 'react';

export interface DeviceOrientationData {
  alpha: number | null; // Z-axis rotation (0-360)
  beta: number | null;  // X-axis rotation (-180 to 180)
  gamma: number | null; // Y-axis rotation (-90 to 90)
  absolute?: boolean;   // True if providing absolute values
  compass?: number;     // Calculated compass heading
}

export interface OrientationPermissionState {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

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
    (typeof (DeviceOrientationEvent as any).requestPermission === 'function' || 
     'ondeviceorientationabsolute' in window);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Device orientation is not supported on this device');
      return false;
    }

    try {
      // For iOS 13+ devices, we need to request permission
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        
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
      (window as any).addEventListener('deviceorientationabsolute', handleOrientationAbsolute, true);
    } else {
      // Fallback to regular deviceorientation
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      if (hasAbsoluteEvent) {
        (window as any).removeEventListener('deviceorientationabsolute', handleOrientationAbsolute, true);
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

// Utility function to format compass direction
export const getCompassDirection = (degrees: number): string => {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

// Utility function to get compass arrow for given direction
export const getCompassArrow = (degrees: number): string => {
  const arrows = [
    '↑', '↗', '→', '↘',
    '↓', '↙', '←', '↖'
  ];
  
  const index = Math.round(degrees / 45) % 8;
  return arrows[index];
};