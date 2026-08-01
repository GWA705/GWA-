'use client';

import { useEffect, useState } from 'react';
import { BannerImage } from './BannerImage';

export interface BannerItem {
  id: string;
  title: string | null;
  body: string | null;
  linkUrl: string | null;
  hasImage: boolean;
}

function Wrap({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {children}
      </a>
    );
  }
  return <>{children}</>;
}

export function BannerCard({ item }: { item: BannerItem }) {
  return (
    <div className="overflow-hidden rounded-lg border border-brand-100 bg-brand-50">
      <Wrap href={item.linkUrl}>
        {item.hasImage && (
          <BannerImage src={`/api/announcements/${item.id}/image`} alt={item.title ?? 'Announcement'} className="block h-auto w-full" />
        )}
        {(item.title || item.body) && (
          <div className="p-4">
            {item.title && <h3 className="text-sm font-semibold text-brand-900">{item.title}</h3>}
            {item.body && <p className="mt-1 whitespace-pre-wrap text-sm text-brand-900/80">{item.body}</p>}
            {item.linkUrl && <span className="mt-1 inline-block text-xs font-medium text-brand-700 underline">Learn more →</span>}
          </div>
        )}
      </Wrap>
    </div>
  );
}

/**
 * Rotating banner slideshow. With one item it just shows it; with several it
 * auto-advances (pausing on hover/focus) and offers arrows and dots. Respects
 * reduced-motion (no auto-advance, no fade) and is keyboard/screen-reader
 * friendly.
 */
export function AnnouncementCarousel({ items, intervalMs = 6000 }: { items: BannerItem[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;
  const i = n ? index % n : 0;

  // Auto-advance, unless paused, single, or the viewer prefers reduced motion.
  useEffect(() => {
    if (n <= 1 || paused) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => setIndex((p) => (p + 1) % n), intervalMs);
    return () => clearInterval(t);
  }, [n, paused, intervalMs]);

  const go = (next: number) => setIndex(((next % n) + n) % n);

  if (n === 0) return null;
  if (n === 1) return <BannerCard item={items[0]} />;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="group"
      aria-roledescription="carousel"
      aria-label="Announcements"
    >
      <div key={items[i].id} className="banner-fade">
        <BannerCard item={items[i]} />
      </div>

      {/* Prev / next */}
      <button
        type="button"
        onClick={() => go(i - 1)}
        aria-label="Previous announcement"
        className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-800 shadow ring-1 ring-black/5 backdrop-blur transition hover:bg-white"
      >
        <span aria-hidden>‹</span>
      </button>
      <button
        type="button"
        onClick={() => go(i + 1)}
        aria-label="Next announcement"
        className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-800 shadow ring-1 ring-black/5 backdrop-blur transition hover:bg-white"
      >
        <span aria-hidden>›</span>
      </button>

      {/* Dots */}
      <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
        {items.map((it, d) => (
          <button
            key={it.id}
            type="button"
            onClick={() => go(d)}
            aria-label={`Go to announcement ${d + 1} of ${n}`}
            aria-current={d === i}
            className={`h-2 rounded-full shadow ring-1 ring-black/10 transition-all ${d === i ? 'w-5 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'}`}
          />
        ))}
      </div>
    </div>
  );
}
