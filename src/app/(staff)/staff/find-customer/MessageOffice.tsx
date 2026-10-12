'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { messageOfficeAction, type MsgState } from './actions';
import { useT } from '@/i18n/client';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('common.sending') : t('staffMisc.findCustomer.notifyOffice')}
    </button>
  );
}

export function MessageOffice({ applicationId, officeName }: { applicationId: string; officeName: string }) {
  const t = useT();
  const [state, action] = useFormState(messageOfficeAction.bind(null, applicationId), {} as MsgState);
  return (
    <form action={action} className="space-y-2">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok ? (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          {t('staffMisc.findCustomer.sentToOffice', { office: officeName })}
        </div>
      ) : (
        <>
          <textarea
            name="message"
            rows={3}
            required
            className="input"
            placeholder={t('staffMisc.findCustomer.messagePlaceholder', { office: officeName })}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">{t('staffMisc.findCustomer.savedAndSent')}</p>
            <SubmitButton />
          </div>
        </>
      )}
    </form>
  );
}
