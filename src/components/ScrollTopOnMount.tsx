'use client';

import { useEffect } from 'react';

/**
 * Scrolls to the top once, on mount. Rendered in the dealer layout so entering
 * the dealer area always starts at the top — server-action redirects (e.g. an
 * admin's "View as dealer") otherwise keep the previous page's scroll position,
 * dropping you at the bottom. Fires only on layout mount (entering the area),
 * not on navigations within it (Next handles those).
 */
export function ScrollTopOnMount() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}
