'use client';

import { useEffect, useState } from 'react';

/**
 * Time-of-day dashboard hero background with a seamless crossfade.
 *
 * The day is split at 5, 12, 15, 17, 19, 21 and 23 hours. Name each image in
 * `public/hero/` by its start hour — `05-*.png`, `12-*.png`, `15-*.png`,
 * `17-*.png`, `19-*.png`, `21-*.png`, `23-*.png` — and the dashboard shows the
 * one matching the viewer's local time, crossfading when the slot changes.
 * If several images share a start hour they cycle within that slot. Falls back
 * to any hero image, then the single `fallback`. Decorative (aria-hidden).
 */

const SLOT_STARTS = [5, 12, 15, 17, 19, 21, 23];

/** Start hour of the slot the given hour falls in (before 5am → the 23 slot). */
function slotFor(hour: number): number {
  let start = SLOT_STARTS[SLOT_STARTS.length - 1]; // overnight (23 → 5)
  for (const s of SLOT_STARTS) if (hour >= s) start = s;
  return start;
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function HeroBackdrop({ images, fallback = '/hero-banner.png' }: { images: string[]; fallback?: string }) {
  const [mounted, setMounted] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [idx, setIdx] = useState(0); // rotation within a slot (when >1 image shares the hour)
  const reduced = useReducedMotion();

  // Compute the slot after mount (client clock) to avoid hydration mismatch,
  // then re-check every minute so it rolls over at the boundary.
  useEffect(() => {
    setMounted(true);
    const tick = () => setSlot(slotFor(new Date().getHours()));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  // Images for the current slot (filename starts with the 2-digit start hour).
  // No image for a slot → the regular hero (`fallback`) shows. That makes the
  // regular /hero-banner.png the default for every slot until a time-specific
  // image is dropped in (e.g. the 05 morning slot until an `05-*` file exists).
  const pad = slot != null ? String(slot).padStart(2, '0') : '';
  const slotImages = slot != null ? images.filter((p) => baseName(p).startsWith(pad)) : [];
  const pool = slotImages.length > 0 ? slotImages : [fallback];

  // Cycle within a multi-image slot (seamless, slow). Reset when the slot changes.
  useEffect(() => { setIdx(0); }, [slot]);
  useEffect(() => {
    if (reduced || pool.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 9_000);
    return () => clearInterval(t);
  }, [reduced, pool.length]);

  const active = !mounted || pool.length === 0 ? fallback : pool[idx % pool.length];

  // Crossfade: stack layers, newest on top fading in over the previous.
  const [layers, setLayers] = useState<{ id: number; src: string }[]>([{ id: 0, src: fallback }]);
  useEffect(() => {
    setLayers((prev) => {
      if (prev[prev.length - 1]?.src === active) return prev;
      return [...prev, { id: (prev[prev.length - 1]?.id ?? 0) + 1, src: active }].slice(-2);
    });
  }, [active]);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {layers.map((l, i) => (
        <div
          key={l.id}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('${l.src}')`,
            opacity: i === layers.length - 1 ? 1 : 0,
            transition: reduced ? 'none' : 'opacity 1200ms ease',
          }}
        />
      ))}
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}
