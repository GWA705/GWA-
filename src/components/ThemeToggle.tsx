'use client';

import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(mode: Mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

/**
 * Simple one-click Light ↔ Dark switch. The choice is saved in localStorage and
 * re-applied on every mount so the page and the button never drift out of sync
 * across navigation. First-time visitors follow their device setting until they
 * pick one. An inline script in the root layout applies the saved choice before
 * first paint so there's no flash.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const initial: Mode = saved === 'dark' ? 'dark' : saved === 'light' ? 'light' : systemPrefersDark() ? 'dark' : 'light';
    setMode(initial);
    apply(initial); // self-heal: make the DOM match the saved choice
  }, []);

  function toggle() {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    apply(next);
  }

  const isDark = mode === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-secondary text-xs"
      aria-pressed={isDark}
      title={isDark ? 'Dark mode — tap for light' : 'Light mode — tap for dark'}
      aria-label={isDark ? 'Dark mode. Tap for light.' : 'Light mode. Tap for dark.'}
    >
      <span aria-hidden>{isDark ? '☾' : '☀'}</span>
      <span className="ml-1 hidden sm:inline">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
