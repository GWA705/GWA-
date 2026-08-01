'use client';

import { useEffect, useState } from 'react';

type Mode = 'light' | 'dark' | 'system';

function apply(mode: Mode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

/**
 * Site-wide light / dark / system theme switch. Persists the choice in
 * localStorage; an inline script in the root layout applies it before first
 * paint so there's no flash.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system');

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Mode) || 'system';
    setMode(saved);
  }, []);

  // Follow the OS when in "system" mode and it changes live.
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  function cycle() {
    const next: Mode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setMode(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    apply(next);
  }

  const label = mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System';
  const icon = mode === 'light' ? '☀' : mode === 'dark' ? '☾' : '◐';

  return (
    <button
      type="button"
      onClick={cycle}
      className="btn-secondary text-xs"
      title={`Theme: ${label} — tap to change`}
      aria-label={`Theme: ${label}. Tap to change.`}
    >
      <span aria-hidden>{icon}</span>
      <span className="ml-1 hidden sm:inline">{label}</span>
    </button>
  );
}
