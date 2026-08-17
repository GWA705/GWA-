'use client';

import { useState } from 'react';

/**
 * When a Home Depot lead includes a "View Project Photos" link, show a clean
 * button that opens Home Depot's photo page in a new tab, with the Booking ID
 * right there to paste (HD's page asks for it before showing the photos).
 */
export function ProjectPhotosButton({ url, bookingId }: { url: string; bookingId: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!bookingId) return;
    navigator.clipboard?.writeText(bookingId).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-orange-900">📷 Customer uploaded project photos</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
        >
          View project photos ↗
        </a>
      </div>
      {bookingId && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-orange-900">
          <span>Home Depot asks for the Booking ID:</span>
          <span className="rounded bg-white px-1.5 py-0.5 font-mono font-semibold ring-1 ring-orange-200">{bookingId}</span>
          <button type="button" onClick={copy} className="font-semibold text-orange-700 hover:underline">
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
