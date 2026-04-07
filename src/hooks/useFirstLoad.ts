'use client';

// ============================================================
// useFirstLoad
// Returns true exactly once — when data first becomes ready.
// Subsequent refreshes do NOT re-trigger the animation.
// ============================================================

import { useState, useEffect, useRef } from 'react';

export function useFirstLoad(ready: boolean): boolean {
  const [isFirstLoad, setIsFirstLoad] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (ready && !hasLoaded.current) {
      hasLoaded.current = true;
      setIsFirstLoad(true);
    }
  }, [ready]);

  return isFirstLoad;
}
