'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { writeToJournalAction, replaceJournalRowAction, type ActionState } from '@/app/(staff)/actions';

function SubmitButton({ synced }: { synced: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Writing…' : synced ? 'Update journal' : 'Write to Journal'}
    </button>
  );
}

function MoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700 disabled:opacity-50"
      onClick={(e) => {
        if (
          !window.confirm(
            'Move this deal to the next blank numbered line in the journal?\n\nIts current row will be cleared and the deal re-written in the correct place. Use this if a deal landed below the totals row.',
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? 'Moving…' : 'Move to the correct line'}
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
        {state.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">{state.message || 'Written to the journal.'}</div>}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {synced
              ? `In journal${tab ? ` — ${tab} row ${row}` : ''}. Last synced ${new Date(syncedAt as string).toLocaleString('en-CA')}.`
              : 'Not yet written to the sales journal.'}
          </p>
          <SubmitButton synced={synced} />
        </div>
      </form>
      {synced && (
        <form action={moveAction} className="space-y-2">
          {moveState.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{moveState.error}</div>}
          {moveState.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">{moveState.message || 'Moved.'}</div>}
          <div className="flex justify-end">
            <MoveButton />
          </div>
        </form>
      )}
    </div>
  );
}
