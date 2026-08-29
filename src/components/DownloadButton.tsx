'use client';

import { useState } from 'react';

/**
 * Downloads a file WITHOUT navigating the app to it. A plain <a href> (even with
 * ?download=1) navigates the current window to the raw file, which dead-ends
 * inside the installed app (a standalone PWA has no browser chrome — no back
 * button), leaving the user stuck on the file. This fetches the bytes and saves
 * them via a blob, so the portal stays exactly where it was.
 *
 * `url` should be the same download endpoint used before (e.g. ".../<id>?download=1");
 * the server's Content-Disposition filename is used when present.
 */
export function DownloadButton({
  url,
  fileName,
  className,
  title,
  children,
}: {
  url: string;
  fileName?: string;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();

      // Prefer the server-provided filename, then the passed one, then a default.
      const cd = res.headers.get('Content-Disposition') ?? '';
      const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
      let name = fileName || (m ? safeDecode(m[1]) : '') || 'download';
      if (!/\.[a-z0-9]{1,8}$/i.test(name)) {
        const ext = extFromType(blob.type);
        if (ext) name += ext;
      }

      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 5000);
    } catch {
      // Never trap the user: if the fetch fails, try a normal new-tab open as a
      // last resort rather than replacing the app view.
      try {
        window.open(url, '_blank', 'noopener');
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handle} disabled={busy} className={className} title={title}>
      {busy ? 'Downloading…' : (children ?? 'Download')}
    </button>
  );
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function extFromType(type: string): string {
  if (type.includes('pdf')) return '.pdf';
  if (type.includes('png')) return '.png';
  if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
  if (type.includes('webp')) return '.webp';
  if (type.includes('heic')) return '.heic';
  return '';
}
