import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The rendered height of an element, kept current through content and viewport
 * changes.
 *
 * The mobile sheet's detents are derived from what its blocks actually measure
 * rather than from hardcoded stops, so a longer trail name or a wrapped legend
 * moves the stop instead of being clipped by it. A change is only committed when
 * it exceeds a pixel: sub-pixel jitter from a layout that depends on the
 * measurement would otherwise re-render forever.
 */
export function useMeasuredHeight<T extends HTMLElement>() {
  const [height, setHeight] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const heightRef = useRef(0);

  const commit = useCallback((next: number) => {
    if (Math.abs(next - heightRef.current) > 1) {
      heightRef.current = next;
      setHeight(next);
    }
  }, []);

  // A callback ref rather than useEffect + RefObject, so the observer attaches
  // the moment the node exists -- including when a block mounts because the
  // sheet changed state.
  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node) {
        return;
      }

      commit(node.offsetHeight);

      const observer = new ResizeObserver(() => commit(node.offsetHeight));
      observer.observe(node);
      observerRef.current = observer;
    },
    [commit],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, height] as const;
}

/**
 * Viewport height in CSS pixels.
 *
 * visualViewport is what actually changes on mobile when the URL bar collapses
 * or a keyboard opens; window.innerHeight lags behind it, and a sheet sized from
 * a stale viewport ends up hanging off the bottom of the screen.
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined'
      ? 0
      : Math.round(window.visualViewport?.height ?? window.innerHeight),
  );

  useEffect(() => {
    const update = () => {
      setHeight(Math.round(window.visualViewport?.height ?? window.innerHeight));
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return height;
}
