'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { writeToJournalAction, type ActionState } from '@/app/(staff)/actions';

function SubmitButton({ synced }: { synced: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Writing…' : synced ? 'Update journal' : 'Write to Journal'}
    </button>
  );
}

/**
 * Pushes the deal into the Google Sheets sales journal. Only rendered once both
 * the HD Customer # and Financing deal number are present. Re-pressing updates
 * the same row (shown by the "last synced" line) instead of adding a duplicate.
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
  const synced = Boolean(syncedAt);
  return (
    <form action={action} className="mt-4 space-y-2 border-t border-gray-100 pt-4">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">Written to the journal.</div>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {synced
            ? `In journal${tab ? ` — ${tab} row ${row}` : ''}. Last synced ${new Date(syncedAt as string).toLocaleString('en-CA')}.`
            : 'Not yet written to the sales journal.'}
        </p>
        <SubmitButton synced={synced} />
      </div>
    </form>
  );
}
