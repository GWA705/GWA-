'use client';

import { useState } from 'react';
import { DownloadButton } from './DownloadButton';

/**
 * A multi-page PDF shown as one tall, scrollable image (all pages rendered
 * server-side). Reliable on iOS, where <object>/<iframe> only show page 1.
 * Falls back to a download link if the render isn't available.
 */
export function PdfPagesImage({
  pagesUrl,
  downloadUrl,
  alt,
}: {
  pagesUrl: string;
  downloadUrl: string;
  alt: string;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  if (state === 'error') {
    return (
      <div className="p-6 text-center text-sm text-gray-600">
        Couldn’t render a preview.{' '}
        <DownloadButton url={downloadUrl} fileName={alt} className="font-semibold text-brand-700 hover:underline">Download it</DownloadButton> to view.
      </div>
    );
  }
  return (
    <>
      {state === 'loading' && <div className="p-6 text-center text-sm text-gray-400">Loading pages…</div>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pagesUrl}
        alt={alt}
        className={`w-full bg-white ${state === 'loading' ? 'hidden' : ''}`}
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
      />
    </>
  );
}
