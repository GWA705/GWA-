'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { setLineResolutionAction, clearLineResolutionAction } from './actions';
import type { RemittanceActionState } from './actions';

/**
 * Mark a chargeback/fee line settled (with a reference), or re-open it. Used on
 * the Chargebacks tracker so the office can record when HD's clawback was paid
 * back and look up the reference later.
 *
 * NOTE: React 18 has no useActionState — use useFormState + useFormStatus.
 */
function SettleButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary text-sm">
      {pending ? 'Saving…' : 'Mark settled'}
    </button>
  );
}

export function ResolveLineForm({ lineId, resolvedAt, resolvedRef }: { lineId: string; resolvedAt: string | null; resolvedRef: string | null }) {
  const [state, action] = useFormState<RemittanceActionState, FormData>(setLineResolutionAction.bind(null, lineId), {});

  if (resolvedAt) {
    return (
      <form action={async () => { await clearLineResolutionAction(lineId); }} className="flex items-center gap-2">
        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
          ✓ Settled {new Date(resolvedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}{resolvedRef ? ` · ${resolvedRef}` : ''}
        </span>
        <button type="submit" className="text-xs text-gray-500 hover:underline">Re-open</button>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="ref" placeholder="Reference (cheque/EFT/credit note)" className="input h-8 w-56 text-sm" />
      <input name="note" placeholder="Note (optional)" className="input h-8 w-48 text-sm" />
      <SettleButton />
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
