'use client';

import { useEffect, useRef, useState } from 'react';
import { BannerImage } from './BannerImage';

export interface BannerItem {
  id: string;
  title: string | null;
  body: string | null;
  linkUrl: string | null;
  hasImage: boolean;
  imageVersion?: number;
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
          <BannerImage src={`/api/announcements/${item.id}/image?v=${item.imageVersion ?? 0}`} alt={item.title ?? 'Announcement'} className="block h-auto w-full" />
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

  // Swipe tracking (touch + mouse drag).
  const dragX = useRef<number | null>(null);

  // Auto-advance, unless paused, single, or the viewer prefers reduced motion.
  useEffect(() => {
    if (n <= 1 || paused) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => setIndex((p) => (p + 1) % n), intervalMs);
    return () => clearInterval(t);
  }, [n, paused, intervalMs]);

  const go = (next: number) => setIndex(((next % n) + n) % n);

  // A horizontal drag/swipe past ~40px flips to the next/previous banner.
  function endSwipe(endX: number) {
    if (dragX.current === null) return;
    const dx = endX - dragX.current;
    dragX.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? i + 1 : i - 1);
  }

  if (n === 0) return null;
  if (n === 1) return <BannerCard item={items[0]} />;

  return (
    <div
      className="relative touch-pan-y select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        dragX.current = null;
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        dragX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        endSwipe(e.changedTouches[0].clientX);
        setPaused(false);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') dragX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'mouse') endSwipe(e.clientX);
      }}
      role="group"
      aria-roledescription="carousel"
      aria-label="Announcements — swipe to change"
    >
      {/* All slides stay mounted and cross-fade by opacity — the images load
          once and are never refetched, so advancing never blanks/reloads the
          banner. The active slide is in normal flow (it sets the height); the
          rest sit behind it. */}
      {items.map((it, d) => (
        <div
          key={it.id}
          aria-hidden={d !== i}
          className={`transition-opacity duration-500 ${
            d === i ? 'relative opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
          }`}
        >
          <BannerCard item={it} />
        </div>
      ))}

      {/* Dots — tap to jump; also show which one you're on. */}
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
