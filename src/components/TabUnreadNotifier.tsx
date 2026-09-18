'use client';

import { useEffect, useRef } from 'react';

/**
 * Flashes the browser-tab title when the signed-in user has unread portal
 * messages and the tab is in the background — so reviewers notice a new message
 * even while working in another tab (the title rotates between the page title and
 * "🔔 (N) new message"). Nothing shows while the tab is focused; the in-app badge
 * covers that. Polls the same summary endpoint the chat badge uses.
 */
export function TabUnreadNotifier({ pollMs = 20000, rotateMs = 1600 }: { pollMs?: number; rotateMs?: number }) {
  const unreadRef = useRef(0);
  const savedTitleRef = useRef<string | null>(null); // the real page title, while we're flashing
  const showingMarkerRef = useRef(false);

  useEffect(() => {
    let stopped = false;

    const marker = (n: number) => `🔔 (${n}) new message${n === 1 ? '' : 's'}`;

    const restore = () => {
      if (savedTitleRef.current !== null) {
        document.title = savedTitleRef.current;
        savedTitleRef.current = null;
      }
      showingMarkerRef.current = false;
    };

    async function poll() {
      try {
        const r = await fetch('/api/chat/summary', { cache: 'no-store' });
        if (r.ok) {
          const data = await r.json();
          unreadRef.current = Number(data?.totalUnread) || 0;
        }
      } catch {
        /* offline — keep last known count */
      }
    }

    const tick = () => {
      if (stopped) return;
      const n = unreadRef.current;
      const active = n > 0 && document.hidden;
      if (!active) {
        restore();
        return;
      }
      // Capture the real title once, the moment we start flashing.
      if (savedTitleRef.current === null) savedTitleRef.current = document.title;
      showingMarkerRef.current = !showingMarkerRef.current;
      document.title = showingMarkerRef.current ? marker(n) : savedTitleRef.current;
    };

    const onVisible = () => {
      // Back on this tab: stop flashing immediately and refresh the count (it
      // clears once the messages are actually read in-app).
      if (!document.hidden) {
        restore();
        void poll();
      }
    };

    void poll();
    const pollTimer = setInterval(poll, pollMs);
    const rotateTimer = setInterval(tick, rotateMs);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearInterval(pollTimer);
      clearInterval(rotateTimer);
      document.removeEventListener('visibilitychange', onVisible);
      restore();
    };
  }, [pollMs, rotateMs]);

  return null;
}
