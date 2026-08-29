'use client';

import { useEffect, useState } from 'react';

/**
 * A tutorial screenshot that enlarges in an in-app lightbox instead of opening
 * the raw image file in a new tab. Opening a bare image URL dead-ends inside the
 * installed mobile app (a standalone PWA has no browser back button), so tapping
 * here opens an overlay with a clear Close button, backdrop-tap and Esc to
 * dismiss — you always stay in the portal.
 */
export function TutorialImage({ src, alt }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    // Prevent the page behind from scrolling while the overlay is up.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="border-t border-gray-100 bg-gray-50 p-4 text-center">
      <button type="button" onClick={() => setOpen(true)} className="inline-block cursor-zoom-in" aria-label="Enlarge screenshot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="mx-auto max-h-96 w-auto rounded-lg border border-gray-200 bg-white shadow-sm"
        />
      </button>
      <p className="mt-2 text-xs text-gray-400">Tap the image to enlarge</p>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt || 'Screenshot'}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-2xl leading-none text-gray-800 shadow-lg hover:bg-white"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full overflow-auto rounded-lg bg-white shadow-2xl"
          />
          <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/80">
            Tap anywhere to close
          </p>
        </div>
      )}
    </div>
  );
}
