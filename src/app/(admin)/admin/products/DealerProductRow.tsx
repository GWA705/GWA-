'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { setDealerCustomProductCodeAction, deleteDealerCustomProductAction, type ActionState } from '@/app/(admin)/actions';

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending}>
      {pending ? 'Saving…' : 'Save code'}
    </button>
  );
}

export function DealerProductRow({
  id,
  name,
  dealerName,
  journalName,
  suggested,
}: {
  id: string;
  name: string;
  dealerName: string;
  journalName: string | null;
  suggested: string;
}) {
  const [state, action] = useFormState(setDealerCustomProductCodeAction, {} as ActionState);
  return (
    <tr>
      <td className="px-4 py-3 font-medium">{name}</td>
      <td className="px-4 py-3 text-gray-600">{dealerName}</td>
      <td className="px-4 py-3">
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input
            name="journalName"
            defaultValue={journalName ?? suggested}
            placeholder={suggested}
            maxLength={12}
            className="input w-24 font-mono uppercase"
          />
          <SaveBtn />
          {state.ok && <span className="text-xs text-green-700">✓</span>}
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        </form>
        {!journalName && <p className="mt-0.5 text-[11px] text-gray-400">Suggested from name — confirm the final code.</p>}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove “${name}” from ${dealerName}'s list?`)) void deleteDealerCustomProductAction(id);
          }}
          className="text-xs font-medium text-red-600 hover:underline"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}
