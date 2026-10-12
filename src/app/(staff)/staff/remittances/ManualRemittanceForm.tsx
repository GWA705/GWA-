'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useT } from '@/i18n/client';
import { ingestManualRemittanceAction, type RemittanceActionState } from './actions';

const initial: RemittanceActionState = {};

function SubmitBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? t('common.processing') : t('remit.manual.submit')}
    </button>
  );
}

export function ManualRemittanceForm() {
  const t = useT();
  const [state, action] = useFormState(ingestManualRemittanceAction, initial);
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-md border border-green-200 bg-green-50 p-2.5 text-sm text-green-800">{t('remit.processed', { summary: state.summary ?? '' })}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="documentNumber">{t('remit.manual.docNumberLabel')} <span className="font-normal text-gray-400">{t('remit.manual.docNumberHint')}</span></label>
          <input id="documentNumber" name="documentNumber" className="input" placeholder="e.g. 12345678" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="paymentDate">{t('remit.paymentDate')} <span className="font-normal text-gray-400">{t('remit.manual.optionalHint')}</span></label>
          <input id="paymentDate" name="paymentDate" type="date" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="lines">{t('remit.lines')}</label>
        <p className="mb-1 text-xs text-gray-500">{t('remit.manual.linesHintBefore')}<code>HD ID, amount, customer name</code>{t('remit.manual.linesHintAfter')}</p>
        <textarea
          id="lines"
          name="lines"
          rows={8}
          className="input font-mono text-xs"
          placeholder={'800251590, 8246.07, LAURA LETIEC\n800251921, 3342.21, MARVIN MASIGLAT\n800244079, -9148.83, ALEXA OLIVARES'}
        />
      </div>
      <SubmitBtn />
    </form>
  );
}
