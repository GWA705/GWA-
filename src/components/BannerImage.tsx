'use client';

import { useState } from 'react';

/**
 * Announcement banner image that shows the whole picture (scaled to fit, no
 * cropping) and quietly removes itself if the file can't load (e.g. an orphaned
 * image). Keeps a broken-image icon from ever showing to dealers.
 */
export function BannerImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className ?? 'max-h-72 w-full object-contain'}
      loading="lazy"
      onError={() => setOk(false)}
    />
  );
}
