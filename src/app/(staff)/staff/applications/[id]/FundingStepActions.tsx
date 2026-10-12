'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { markFundedAction, syncDealFromJournalAction } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

/**
 * "Mark Funded" right inside the Awaiting-funding step, so the reviewer can mark
 * it here instead of going up to the status menu. Logs the funded date via the
 * status history. Also offers "Check journal now" — reads the deal's journal row
 * and, if it shows OK + a Date Paid, marks it Funded (& Paid) automatically. A
 * scheduled sweep does the same on its own; this is the manual trigger.
 */
export function FundingStepActions({
  applicationId,
  journalCheckedAt,
  canMarkFunded = true,
}: {
  applicationId: string;
  journalCheckedAt?: string | null;
  // Hidden once the deal is already Funded — then only "Check journal now" shows.
  canMarkFunded?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [marked, setMarked] = useState(false); // optimistic: flip instantly on tap
  const [pending, start] = useTransition();
  const [checking, startCheck] = useTransition();

  function mark() {
    setError(null);
    setMessage(null);
    setMarked(true); // instant feedback — don't wait for the round-trip
    start(async () => {
      const res = await markFundedAction(applicationId);
      if (res?.error) {
        setMarked(false); // roll back on failure
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function checkJournal() {
    setError(null);
    setMessage(null);
    startCheck(async () => {
      const res = await syncDealFromJournalAction(applicationId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setMessage(res.message ?? t('staffCards.fundingStep.checked'));
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {canMarkFunded && (
          <button
            type="button"
            onClick={mark}
            disabled={pending || checking || marked}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-70"
          >
            {marked ? t('staffCards.fundingStep.funded') : t('staffCards.fundingStep.markFunded')}
          </button>
        )}
        <button
          type="button"
          onClick={checkJournal}
          disabled={pending || checking}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:opacity-50"
          title={t('staffCards.fundingStep.checkJournalTitle')}
        >
          {checking ? t('common.checking') : t('staffCards.fundingStep.checkJournal')}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {t('staffCards.fundingStep.desc1')}<strong>{t('staffCards.fundingStep.payDealer')}</strong>{t('staffCards.fundingStep.desc2')}<strong>{t('staffCards.fundingStep.okPaid')}</strong>{t('staffCards.fundingStep.desc3')}
      </p>
      {message && <p className="mt-1 text-xs text-emerald-700">{message}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {journalCheckedAt && !message && (
        <p className="mt-1 text-[11px] text-gray-400">{t('staffCards.fundingStep.lastChecked', { when: new Date(journalCheckedAt).toLocaleString('en-CA') })}</p>
      )}
    </div>
  );
}
