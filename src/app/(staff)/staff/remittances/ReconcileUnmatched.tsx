'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useT } from '@/i18n/client';
import { reconcileUnmatchedAction, type RemittanceActionState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" disabled={pending} className="btn-secondary text-sm disabled:opacity-60">
      {pending ? t('common.checking') : t('remit.reconcile.submit')}
    </button>
  );
}

/**
 * Re-runs the HD-# match for every stored unmatched line against the deals that
 * are in the portal now, funding any that have since appeared. For recovering HD
 * payments that landed before their deal existed in the portal.
 */
export function ReconcileUnmatched() {
  const [state, formAction] = useFormState<RemittanceActionState, FormData>(reconcileUnmatchedAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <SubmitButton />
      {state.summary && <span className="text-sm text-green-700">{state.summary}</span>}
      {state.error && <span className="text-sm text-red-700">{state.error}</span>}
    </form>
  );
}
