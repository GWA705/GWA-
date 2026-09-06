'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { recordPayoutAction, type ActionState } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? t('payoutForm.saving') : t('payoutForm.submit')}
    </button>
  );
}

export function PayoutForm({ applicationId }: { applicationId: string }) {
  const t = useT();
  const [state, action] = useFormState(recordPayoutAction, {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">{t('payoutForm.recorded')}</div>}
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="amount">{t('payoutForm.amountLabel')}</label><input id="amount" name="amount" type="number" step="0.01" min="0" required className="input" /></div>
        <div><label className="label" htmlFor="paidOn">{t('payoutForm.paidOnLabel')}</label><input id="paidOn" name="paidOn" type="date" required className="input" /></div>
        <div><label className="label" htmlFor="method">{t('payoutForm.methodLabel')}</label><input id="method" name="method" className="input" placeholder={t('payoutForm.methodPlaceholder')} /></div>
        <div><label className="label" htmlFor="reference">{t('payoutForm.referenceLabel')}</label><input id="reference" name="reference" className="input" /></div>
      </div>
      <div><label className="label" htmlFor="note">{t('payoutForm.noteLabel')}</label><input id="note" name="note" className="input" /></div>
      <SubmitButton />
    </form>
  );
}
