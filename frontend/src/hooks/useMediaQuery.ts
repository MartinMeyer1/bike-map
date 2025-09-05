import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

// Predefined mobile breakpoint hooks
export const useIsMobile = (): boolean => {
  // Use a combination of screen size AND touch capability to detect mobile devices
  // This handles landscape mobile devices that might have width > 768px
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isSmallHeight = useMediaQuery('(max-height: 768px)');
  const isTouchDevice = useMediaQuery('(pointer: coarse)');
  const hasHover = useMediaQuery('(hover: hover)');
  
  // Mobile if: small screen OR (touch device without hover capability and small height in landscape)
  return isSmallScreen || (isTouchDevice && !hasHover && isSmallHeight);
};

export const useIsTablet = (): boolean => {
  return useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
};

export const useIsDesktop = (): boolean => {
  return useMediaQuery('(min-width: 1025px)');
};

// Touch device detection
export const useIsTouchDevice = (): boolean => {
  return useMediaQuery('(pointer: coarse)');
};

// Orientation detection
export const useIsPortrait = (): boolean => {
  return useMediaQuery('(orientation: portrait)');
};

export const useIsLandscape = (): boolean => {
  return useMediaQuery('(orientation: landscape)');
};