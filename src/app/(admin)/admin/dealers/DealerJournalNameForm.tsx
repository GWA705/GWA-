'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { setDealerJournalNameAction, type ActionState } from '@/app/(admin)/actions';

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

/**
 * Inline editor for the dealer's sales-journal "Location" name. Leave it blank to
 * write the dealer's full name; type a short form (e.g. "GWA") to override it.
 */
export function DealerJournalNameForm({
  id,
  name,
  journalName,
}: {
  id: string;
  name: string;
  journalName: string | null;
}) {
  const [state, action] = useFormState(setDealerJournalNameAction, {} as ActionState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="journalName"
        defaultValue={journalName ?? ''}
        placeholder={name}
        maxLength={40}
        aria-label={`Journal name for ${name}`}
        className="input w-40"
      />
      <SaveBtn />
      {state.ok && <span className="text-xs text-green-700">✓</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
