'use client';

import { useState } from 'react';
import type { Document } from '@prisma/client';

/**
 * Preview tile for a paperwork document. Shows the server-rendered thumbnail
 * (image downscale / PDF first page, via /api/documents/[id]/thumb) so a PDF
 * reads as the actual page rather than a generic icon. Falls back to a clean
 * stylized page with a coloured file-type ribbon if there's no preview or it
 * fails to load.
 */
export function PaperworkThumb({ doc }: { doc: Pick<Document, 'id' | 'mimeType' | 'fileName'> }) {
  const [failed, setFailed] = useState(false);
  const isImage = (doc.mimeType || '').startsWith('image/');
  const isPdf = (doc.mimeType || '').includes('pdf');

  if ((isImage || isPdf) && !failed) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={`/api/documents/${doc.id}/thumb`}
        alt=""
        className="h-20 w-16 flex-none rounded-lg bg-white object-cover ring-1 ring-gray-200"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  const ribbon = isPdf ? 'bg-red-600' : 'bg-blue-600';
  const label = isPdf ? 'PDF' : (doc.fileName.split('.').pop() || 'FILE').slice(0, 4).toUpperCase();
  return (
    <div className="relative h-20 w-16 flex-none overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200" aria-hidden>
      {/* folded corner */}
      <div className="absolute right-0 top-0 h-4 w-4 bg-gray-100" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
      {/* faint text lines to read as a page */}
      <div className="space-y-1.5 p-2.5 pt-3">
        <div className="h-1 w-9 rounded bg-gray-200" />
        <div className="h-1 w-7 rounded bg-gray-200" />
        <div className="h-1 w-8 rounded bg-gray-200" />
        <div className="h-1 w-6 rounded bg-gray-200" />
      </div>
      <div className={`absolute inset-x-0 bottom-0 ${ribbon} py-0.5 text-center text-[9px] font-bold tracking-wide text-white`}>
        {label}
      </div>
    </div>
  );
}
