'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleFinanceNumberVerifiedAction } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

/**
 * "Verify financing number" toggle. Flips to verified (or back) immediately on
 * click while the save runs in the background, so the reviewer isn't left
 * waiting on a round-trip. The optimistic value reconciles with the server once
 * revalidation lands; the "by … · date" byline appears once the server confirms.
 */
export function VerifyFinanceNumberButton({
  applicationId,
  verified,
  canVerify,
  verifiedByName,
  verifiedAt,
}: {
  applicationId: string;
  verified: boolean;
  canVerify: boolean;
  verifiedByName: string | null;
  verifiedAt: string | null;
}) {
  const t = useT();
  const [optimisticVerified, setOptimistic] = useOptimistic(verified, (_prev, next: boolean) => next);
  const [, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      setOptimistic(!optimisticVerified);
      await toggleFinanceNumberVerifiedAction(applicationId);
    });
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      {optimisticVerified ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="badge bg-green-100 text-green-800">{t('dealParts.financeNum.verifiedBadge')}</span>
            <button type="button" onClick={toggle} className="text-xs text-gray-500 hover:underline">{t('dealParts.financeNum.undo')}</button>
          </div>
          {verified && verifiedByName && (
            <p className="mt-1 text-xs text-gray-400">
              {t('dealParts.financeNum.by', { name: verifiedByName })}{verifiedAt ? ` · ${verifiedAt}` : ''}
            </p>
          )}
        </>
      ) : (
        <>
          <button type="button" onClick={toggle} className="btn-secondary text-xs" disabled={!canVerify}>
            {t('dealParts.financeNum.verify')}
          </button>
          <p className="mt-1 text-xs text-gray-400">
            {canVerify
              ? t('dealParts.financeNum.confirmValid')
              : t('dealParts.financeNum.addFirst')}
          </p>
        </>
      )}
    </div>
  );
}
