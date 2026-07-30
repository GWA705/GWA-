'use client';

import { useState } from 'react';

/**
 * Announcement banner image. Renders full-width at the image's natural aspect
 * ratio, so a correctly-sized banner fills the area edge-to-edge on desktop and
 * scales down cleanly on mobile — no cropping, no letterboxing. Quietly removes
 * itself if the file can't load (e.g. an orphaned image), so a broken-image icon
 * never shows to dealers.
 */
export function BannerImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className ?? 'block h-auto w-full'}
      loading="lazy"
      onError={() => setOk(false)}
    />
  );
}
