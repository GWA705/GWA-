'use client';

import { useState } from 'react';
import { DownloadButton } from './DownloadButton';
import { useT } from '@/i18n/client';

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
  const t = useT();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  if (state === 'error') {
    return (
      <div className="p-6 text-center text-sm text-gray-600">
        {t('dealParts.pdfPages.cantRender')}{' '}
        <DownloadButton url={downloadUrl} fileName={alt} className="font-semibold text-brand-700 hover:underline">{t('common.downloadIt')}</DownloadButton>{' '}{t('dealParts.pdfPages.toView')}
      </div>
    );
  }
  return (
    <>
      {state === 'loading' && <div className="p-6 text-center text-sm text-gray-400">{t('dealParts.pdfPages.loadingPages')}</div>}
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
