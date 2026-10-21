'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { pullFinanceitInfoAction } from '@/app/(staff)/actions';
import type { ActionState } from '@/app/(staff)/actions';

/**
 * Reviewer-side "Pull from FinanceIt" button. Fetches the deal's FinanceIt
 * approval/funding email and fills any missing confirmer fields (financing
 * amount, term, monthly payment, phone) + confirms the FinanceIt number. Only
 * fills blanks; safe to click again. After a pull the page revalidates, so the
 * confirmation form below shows the new values.
 */
function Button() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-sm" disabled={pending}>
      {pending ? 'Checking FinanceIt…' : '⬇ Pull from FinanceIt email'}
    </button>
  );
}

export function FinanceitPullButton({ applicationId }: { applicationId: string }) {
  const [state, action] = useFormState(pullFinanceitInfoAction, {} as ActionState);
  return (
    <form action={action} className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="applicationId" value={applicationId} />
        <Button />
        <p className="text-xs text-gray-500">
          Brings in the amount, term, monthly payment &amp; phone from FinanceIt and verifies the loan number.
        </p>
      </div>
      {state.error && (
        <div className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>
      )}
      {state.ok && state.message && (
        <div className="mt-2 rounded-md bg-green-50 p-2 text-sm text-green-800">{state.message}</div>
      )}
    </form>
  );
}
