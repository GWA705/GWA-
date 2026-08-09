'use client';

import { useTransition } from 'react';
import { runDocumentOcrAction } from '@/app/(staff)/actions';

/**
 * "Read this scan" — triggers Tier-2 OCR for a scanned/photo document on demand.
 * Runs in a transition (a few seconds); the Auto-check chips refresh with any
 * dates found once it lands.
 */
export function OcrButton({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => runDocumentOcrAction(documentId))}
      className="rounded-full px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-50 disabled:opacity-60"
      title="Read the text off this scan/photo"
    >
      {pending ? 'Reading…' : '🔍 Read this scan'}
    </button>
  );
}
