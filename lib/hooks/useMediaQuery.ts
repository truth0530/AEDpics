'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const updateMatch = (event: MediaQueryListEvent | MediaQueryList) => {
      setMatches(event.matches);
    };

    updateMatch(mediaQueryList);

    const listener = (event: MediaQueryListEvent) => updateMatch(event);

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', listener);
      return () => mediaQueryList.removeEventListener('change', listener);
    }

    // Fallback for older browsers
    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(listener);
      return () => mediaQueryList.removeListener(listener);
    }

    return undefined;
  }, [query]);

  return matches;
}
