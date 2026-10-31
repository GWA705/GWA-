'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { recompressDocumentsAction } from '@/app/(staff)/actions';

/**
 * Maintenance button: shrink this deal's oversized stored scans in place (for
 * files uploaded before the resolution cap). Reviewer/admin only. Bounded +
 * resumable — if it reports files remaining, click again. Confirms first since
 * it rewrites the stored files.
 */
export function RecompressDocsButton({ applicationId, className }: { applicationId: string; className?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    if (pending) return;
    if (!window.confirm('Shrink this deal’s stored scans to a lighter resolution? This rewrites the stored files (kept fully legible) so they download and open faster. Safe to run.')) {
      return;
    }
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await recompressDocumentsAction(applicationId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setMessage(res.message ?? 'Done.');
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={className}
        title="Shrink oversized stored scans so they download and open faster (rewrites the files, kept legible)."
      >
        {pending ? 'Shrinking…' : '🗜 Shrink stored scans'}
      </button>
      {message && <span className="text-[11px] font-medium text-emerald-700">{message}</span>}
      {error && <span className="text-[11px] font-medium text-red-600">{error}</span>}
    </span>
  );
}
