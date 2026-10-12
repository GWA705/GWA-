'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { writeToJournalAction, replaceJournalRowAction, type ActionState } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

function SubmitButton({ synced }: { synced: boolean }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? t('staffDeal.journal.writing') : synced ? t('staffDeal.journal.update') : t('staffDeal.journal.write')}
    </button>
  );
}

function MoveButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700 disabled:opacity-50"
      onClick={(e) => {
        if (!window.confirm(t('staffDeal.journal.moveConfirm'))) {
          e.preventDefault();
        }
      }}
    >
      {pending ? t('common.moving') : t('staffDeal.journal.moveToCorrectLine')}
    </button>
  );
}

/**
 * Pushes the deal into the Google Sheets sales journal. Only rendered once both
 * the HD Customer # and Financing deal number are present. Re-pressing updates
 * the same row (shown by the "last synced" line) instead of adding a duplicate.
 *
 * When a deal is already synced, a secondary "Move to the correct line" control
 * re-places it on the next blank numbered line — the cure for the handful of
 * deals the old writer appended below the totals row.
 */
export function WriteToJournalButton({
  applicationId,
  syncedAt,
  tab,
  row,
}: {
  applicationId: string;
  syncedAt: string | null;
  tab: string | null;
  row: number | null;
}) {
  const t = useT();
  const [state, action] = useFormState(
    writeToJournalAction.bind(null, applicationId),
    {} as ActionState,
  );
  const [moveState, moveAction] = useFormState(
    replaceJournalRowAction.bind(null, applicationId),
    {} as ActionState,
  );
  const synced = Boolean(syncedAt);
  return (
    <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
      <form action={action} className="space-y-2">
        {state.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{state.error}</div>}
        {state.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">{state.message || t('staffDeal.journal.written')}</div>}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {synced
              ? `${t('staffDeal.journal.inJournal')}${tab ? ` ${t('staffDeal.journal.tabRow', { tab, row: row ?? '' })}` : ''}. ${t('staffDeal.journal.lastSynced', { time: new Date(syncedAt as string).toLocaleString('en-CA') })}`
              : t('staffDeal.journal.notYet')}
          </p>
          <SubmitButton synced={synced} />
        </div>
      </form>
      {synced && (
        <form action={moveAction} className="space-y-2">
          {moveState.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{moveState.error}</div>}
          {moveState.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">{moveState.message || t('staffDeal.journal.moved')}</div>}
          <div className="flex justify-end">
            <MoveButton />
          </div>
        </form>
      )}
    </div>
  );
}
