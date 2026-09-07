'use client';

import { useCallback, useEffect, useState } from 'react';

// Per-device preference for the dealer "quick bar" (the bottom shortcut bar on
// phones). Stored in localStorage so it survives reloads without a DB/migration;
// it's a lightweight UI convenience, not account data. Default ON — the bar is
// the point, and dealers can switch it off from the mobile menu.
const KEY = 'gwa-quickbar';
const EVENT = 'gwa-quickbar-change';

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

/**
 * Returns `[enabled, setEnabled]`. Initial state is `true` on both server and
 * first client render (the default), so hydration matches; the effect then
 * reconciles with whatever the device stored. Changes broadcast on a window
 * event so the toggle in the drawer and the bar itself stay in sync live.
 */
export function useQuickBar(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(read());
    const onChange = () => setEnabled(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange); // other tabs
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* storage blocked (private mode) — keep the in-memory choice */
    }
    setEnabled(v);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [enabled, set];
}
