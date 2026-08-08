'use client';

import { useEffect, useState } from 'react';

/**
 * Opens a deal document inside the app in a full-screen overlay with a Back
 * button, instead of navigating the browser to the raw file. In the installed
 * app (standalone PWA) there's no browser chrome, so a raw-file navigation left
 * reviewers stuck on the file with no way back — this keeps them in the app.
 *
 * Renders the trigger as a link-styled button; `children` is the visible label.
 * Images show in an <img>; everything else (PDFs, etc.) renders in an <iframe>,
 * with "open in new tab" and "download" as fallbacks in the header.
 */
export function DocViewer({
  id,
  fileName,
  mimeType,
  className,
  title,
  children,
}: {
  id: string;
  fileName: string;
  mimeType?: string | null;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const src = `/api/documents/${id}`;
  const isImage = (mimeType ?? '').startsWith('image/');

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

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} title={title ?? fileName}>
        {children}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80" role="dialog" aria-modal="true" aria-label={fileName}>
          <div className="flex flex-none items-center gap-2 bg-white px-2 py-2 shadow">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-brand-700 hover:bg-gray-100"
            >
              ‹ Back
            </button>
            <span className="min-w-0 flex-1 truncate text-center text-sm font-medium text-gray-700">{fileName}</span>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              title="Open in a new tab"
            >
              ↗
            </a>
            <a
              href={`${src}?download=1`}
              className="flex-none rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              title="Download"
            >
              ⬇
            </a>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {isImage ? (
              <div className="flex min-h-full items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={fileName} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <iframe src={src} title={fileName} className="h-full w-full border-0 bg-white" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
