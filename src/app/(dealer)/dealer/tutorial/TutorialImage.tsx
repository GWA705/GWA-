'use client';

import { useEffect, useState } from 'react';
import { TutorialIllo } from './illustrations';

/**
 * A tutorial screenshot that enlarges in an in-app lightbox instead of opening
 * the raw image file in a new tab (a standalone PWA has no browser back button).
 *
 * If the screenshot file isn't present yet, it falls back to the step's line
 * mockup (`illo`) so the tutorial always looks finished while real screenshots
 * are being captured — drop the PNG into `public/tutorial/` and it takes over.
 */
export function TutorialImage({ src, alt, illo }: { src: string; alt?: string; illo?: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // No screenshot yet → show the mockup (or a neutral placeholder).
  if (failed) {
    return (
      <div className="border-t border-gray-100 bg-gray-50 p-5">
        {illo ? (
          <TutorialIllo name={illo} />
        ) : (
          <div className="mx-auto flex h-40 max-w-md items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
            Screenshot coming soon
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 p-4 text-center">
      <button type="button" onClick={() => setOpen(true)} className="inline-block cursor-zoom-in" aria-label="Enlarge screenshot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
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
