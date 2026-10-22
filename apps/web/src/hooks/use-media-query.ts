import { useSyncExternalStore } from 'react';

/**
 * Live result of a CSS media query. The server render (and any environment without
 * matchMedia, such as tests) answers false.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () =>
      typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  );
}

/** Phones and tablets: the primary pointer is a finger. */
export const useIsTouch = () => useMediaQuery('(pointer: coarse)');
