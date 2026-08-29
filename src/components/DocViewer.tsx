'use client';

import { useEffect, useState } from 'react';
import { DownloadButton } from './DownloadButton';

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
  src: srcProp,
  children,
}: {
  id: string;
  fileName: string;
  mimeType?: string | null;
  className?: string;
  title?: string;
  // Where the file is served from. Defaults to the deal-document endpoint; pass
  // a different base (e.g. /api/resource-files/<id>) for other document types.
  src?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const src = srcProp ?? `/api/documents/${id}`;
  const isImage = (mimeType ?? '').startsWith('image/');
  const isPdf = (mimeType ?? '') === 'application/pdf';

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
            <DownloadButton
              url={`${src}?download=1`}
              fileName={fileName}
              className="flex-none rounded-md px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              title="Download"
            >
              ⬇
            </DownloadButton>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {isImage ? (
              <div className="flex min-h-full items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={fileName} className="max-h-full max-w-full object-contain" />
              </div>
            ) : isPdf ? (
              <PdfPages pagesUrl={`${src}/pages`} fileUrl={src} fileName={fileName} />
            ) : (
              <iframe src={src} title={fileName} className="h-full w-full border-0 bg-white" />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Multi-page PDF as one tall, scrollable image (all pages rendered server-side).
 * This is the reliable way to read a PDF inside the app — an <iframe> only shows
 * page 1 on iOS and won't scroll. Falls back to a download prompt if the render
 * isn't available.
 */
function PdfPages({ pagesUrl, fileUrl, fileName }: { pagesUrl: string; fileUrl: string; fileName: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  return (
    <div className="mx-auto min-h-full w-full max-w-3xl p-2 sm:p-4">
      {state === 'loading' && (
        <div className="py-12 text-center text-sm text-white/70">Loading pages…</div>
      )}
      {state === 'error' ? (
        <div className="py-12 text-center text-sm text-white/80">
          Couldn’t render a preview.{' '}
          <DownloadButton url={`${fileUrl}?download=1`} fileName={fileName} className="font-semibold text-white underline">Download the PDF</DownloadButton> instead.
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pagesUrl}
          alt={fileName}
          className={`w-full rounded bg-white shadow-lg ${state === 'loading' ? 'hidden' : ''}`}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
        />
      )}
    </div>
  );
}
