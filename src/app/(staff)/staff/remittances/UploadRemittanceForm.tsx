'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useT } from '@/i18n/client';
import { ingestRemittancePdfAction, type RemittanceActionState } from './actions';

const initial: RemittanceActionState = {};

function SubmitBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? t('remit.upload.reading') : t('remit.upload.submit')}
    </button>
  );
}

export function UploadRemittanceForm() {
  const t = useT();
  const [state, action] = useFormState(ingestRemittancePdfAction, initial);
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-md border border-green-200 bg-green-50 p-2.5 text-sm text-green-800">{t('remit.processed', { summary: state.summary ?? '' })}</p>}
      <p className="text-sm text-gray-500">
        {t('remit.upload.blurbBefore')}<strong>{t('remit.upload.remittanceAdvice')}</strong>{t('remit.upload.blurbAfter')}
      </p>
      <input
        type="file"
        name="pdf"
        accept="application/pdf,.pdf"
        required
        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
      />
      <SubmitBtn />
    </form>
  );
}
