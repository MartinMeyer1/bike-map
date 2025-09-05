import { useState, useEffect, useCallback, useRef } from 'react';

export interface UserPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface GeolocationState {
  position: UserPosition | null;
  error: GeolocationError | null;
  isLoading: boolean;
  isSupported: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  watch?: boolean;
  watchInterval?: number;
}

const defaultOptions: Required<UseGeolocationOptions> = {
  enableHighAccuracy: true,
  maximumAge: 5000, // 5 seconds
  timeout: 10000, // 10 seconds
  watch: true,
  watchInterval: 2000 // 2 seconds
};

export const useGeolocation = (options: UseGeolocationOptions = {}): GeolocationState & {
  getCurrentPosition: () => void;
  startWatching: () => void;
  stopWatching: () => void;
} => {
  const opts = { ...defaultOptions, ...options };
  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    isLoading: false,
    isSupported: 'geolocation' in navigator
  });

  const watchIdRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const updatePosition = useCallback((geoPosition: GeolocationPosition) => {
    const position: UserPosition = {
      latitude: geoPosition.coords.latitude,
      longitude: geoPosition.coords.longitude,
      accuracy: geoPosition.coords.accuracy,
      heading: geoPosition.coords.heading || undefined,
      speed: geoPosition.coords.speed || undefined,
      timestamp: geoPosition.timestamp
    };

    setState(prev => ({
      ...prev,
      position,
      error: null,
      isLoading: false
    }));
  }, []);

  const updateError = useCallback((geoError: GeolocationPositionError) => {
    const error: GeolocationError = {
      code: geoError.code,
      message: geoError.message
    };

    setState(prev => ({
      ...prev,
      error,
      position: null,
      isLoading: false
    }));
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!state.isSupported) {
      updateError({
        code: 0,
        message: 'Geolocation is not supported by this browser'
      } as GeolocationPositionError);
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      updatePosition,
      updateError,
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        maximumAge: opts.maximumAge,
        timeout: opts.timeout
      }
    );
  }, [state.isSupported, opts.enableHighAccuracy, opts.maximumAge, opts.timeout, updatePosition, updateError]);

  const startWatching = useCallback(() => {
    if (!state.isSupported || watchIdRef.current !== null) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      updatePosition,
      updateError,
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        maximumAge: opts.maximumAge,
        timeout: opts.timeout
      }
    );
  }, [state.isSupported, opts.enableHighAccuracy, opts.maximumAge, opts.timeout, updatePosition, updateError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  useEffect(() => {
    if (opts.watch && state.isSupported) {
      // Start watching automatically with a slight delay
      timeoutRef.current = setTimeout(() => {
        startWatching();
      }, 100);
    }

    return () => {
      stopWatching();
    };
  }, [opts.watch, state.isSupported, startWatching, stopWatching]);

  return {
    ...state,
    getCurrentPosition,
    startWatching,
    stopWatching
  };
};