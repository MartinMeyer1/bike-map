import { useCallback, useSyncExternalStore } from 'react';

const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot);
};

export const useIsMobile = (): boolean => {
  // Screen size alone misclassifies landscape phones, which can exceed 768px wide.
  // Pairing it with touch-without-hover catches those.
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isSmallHeight = useMediaQuery('(max-height: 768px)');
  const isTouchDevice = useMediaQuery('(pointer: coarse)');
  const hasHover = useMediaQuery('(hover: hover)');

  return isSmallScreen || (isTouchDevice && !hasHover && isSmallHeight);
};
