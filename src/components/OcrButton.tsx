'use client';

import { useTransition } from 'react';
import { runDocumentOcrAction } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

/**
 * "Read this scan" — triggers Tier-2 OCR for a scanned/photo document on demand.
 * Runs in a transition (a few seconds); the Auto-check chips refresh with any
 * dates found once it lands.
 */
export function OcrButton({ documentId }: { documentId: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => runDocumentOcrAction(documentId))}
      className="rounded-full px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-50 disabled:opacity-60"
      title={t('dealParts.ocr.title')}
    >
      {pending ? t('common.reading') : t('dealParts.ocr.readScan')}
    </button>
  );
}
