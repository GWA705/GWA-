'use client';

import { useEffect } from 'react';

/**
 * Keeps installed home-screen apps (and long-open tabs) from getting stuck on an
 * old version after a deploy. The page is rendered by a server on build X (passed
 * in as currentBuildId). Whenever the app regains focus — the moment someone
 * reopens the home-screen app, which is exactly when the stale copy showed before
 * — we ask the server for its current build id; if it changed, the code is out of
 * date and we reload to pick up the new version.
 *
 * We intentionally check only on load and on focus, not on a timer, so an active
 * dealer mid-form is never reloaded out from under their typing.
 */
export function VersionWatcher({ currentBuildId }: { currentBuildId: string }) {
  useEffect(() => {
    // No stable id in dev — nothing to compare against.
    if (!currentBuildId || currentBuildId === 'development') return;

    let stopped = false;

    async function check() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        if (!stopped && data.buildId && data.buildId !== currentBuildId) {
          window.location.reload();
        }
      } catch {
        // Offline or transient — try again on the next focus.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') check();
    }

    document.addEventListener('visibilitychange', onVisible);
    // One check shortly after load, in case a deploy landed while the app was
    // sitting open in the background.
    const t = window.setTimeout(check, 3000);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(t);
    };
  }, [currentBuildId]);

  return null;
}
