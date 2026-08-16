'use client';

import { useState } from 'react';

/**
 * Small preview tile for a deal document. Shows the server-rendered thumbnail
 * (image downscale / PDF first page); falls back to a labelled file glyph when
 * there's no preview or it fails to load.
 */
export function DocThumbnail({
  id,
  mimeType,
  className,
}: {
  id: string;
  mimeType?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const mime = mimeType ?? '';
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  const canThumb = (isImage || isPdf) && !failed;
  const kind = isPdf ? 'PDF' : isImage ? 'IMG' : 'FILE';

  return (
    <div className={`flex h-16 w-12 flex-none items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white ${className ?? ''}`}>
      {canThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/documents/${id}/thumb`}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex flex-col items-center gap-0.5 text-gray-400">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span className="text-[9px] font-semibold tracking-wide">{kind}</span>
        </div>
      )}
    </div>
  );
}
