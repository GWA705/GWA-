'use client';

import { useEffect, useState } from 'react';
import { slotForHour, isNightSlot } from '@/lib/heroSlots';

/**
 * Time-of-day dashboard hero background with a seamless crossfade.
 *
 * The server resolves which image(s) belong to each slot (admin uploads override
 * the built-in file heroes) and whether a special occasion is taking over right
 * now. This component just picks the slot for the viewer's local time, applies a
 * special-occasion override when one is live, and crossfades between images.
 * Decorative (aria-hidden).
 */
export interface HeroSpecial {
  src: string;
  scope: 'ALL' | 'NIGHT';
}

export function HeroBackdrop({
  slotImages = {},
  special = null,
  fallback = '/hero-banner.webp',
}: {
  slotImages?: Record<number, string[]>;
  special?: HeroSpecial | null;
  fallback?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const reduced = useReducedMotion();

  // Resolve the slot from the client clock after mount (avoids hydration
  // mismatch), then re-check each minute so it rolls over at the boundary.
  useEffect(() => {
    setMounted(true);
    const tick = () => setSlot(slotForHour(new Date().getHours()));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  // A live special occasion takes over every slot (ALL) or just the night slots
  // (NIGHT). Otherwise show the slot's own image(s), or the fallback.
  const specialActive = !!special && slot != null && (special.scope === 'ALL' || (special.scope === 'NIGHT' && isNightSlot(slot)));
  const slotPool = slot != null ? (slotImages[slot] ?? []) : [];
  const pool = specialActive && special ? [special.src] : (slotPool.length > 0 ? slotPool : [fallback]);

  useEffect(() => { setIdx(0); }, [slot, specialActive]);
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
