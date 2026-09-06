'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { recordDecisionAction, type ActionState } from '@/app/(staff)/actions';
import { hdOriginLabel } from '@/lib/constants';
import { useT } from '@/i18n/client';
import { decisionDisplayLabel } from '@/lib/enumLabels';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('decisionForm.saving') : t('decisionForm.submit')}
    </button>
  );
}

export function DecisionForm({
  applicationId,
  options,
  financeCompanies,
  defaultAmount,
  defaultFinanceCompanyId,
  defaultFinanceItNumber,
  defaultHdReference,
  hdRequired,
}: {
  applicationId: string;
  options: { value: string; label: string }[];
  financeCompanies: { id: string; name: string }[];
  defaultAmount: string;
  defaultFinanceCompanyId?: string | null;
  defaultFinanceItNumber?: string | null;
  defaultHdReference?: string | null;
  hdRequired: boolean;
}) {
  const t = useT();
  const [state, action] = useFormState(recordDecisionAction, {} as ActionState);
  const [type, setType] = useState(options[0]?.value ?? '');
  const isApproval = type === 'APPROVE' || type === 'CONDITIONAL';
  const [hd, setHd] = useState(defaultHdReference ?? '');
  const origin = hdOriginLabel(hd);

  if (options.length === 0) {
    return <p className="text-sm text-gray-500">{t('decisionForm.noOptions')}</p>;
  }

  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{state.error}</div>
      )}
      {state.ok && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{t('decisionForm.recorded')}</div>
      )}
      <input type="hidden" name="applicationId" value={applicationId} />
      <div>
        <label className="label" htmlFor="type">{t('decisionForm.decisionLabel')}</label>
        <select id="type" name="type" required className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{decisionDisplayLabel(t, o.value)}</option>
          ))}
        </select>
      </div>

      {isApproval && (
        <div className="space-y-3 rounded-md bg-green-50/50 p-3 ring-1 ring-green-100">
          <div>
            <label className="label" htmlFor="approvedAmount">{t('decisionForm.approvedAmount')}</label>
            <input id="approvedAmount" name="approvedAmount" type="number" step="0.01" min="0" defaultValue={defaultAmount} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="financeCompanyId">{t('decisionForm.financeCompany')} <span className="text-red-500">*</span></label>
            <select id="financeCompanyId" name="financeCompanyId" defaultValue={defaultFinanceCompanyId ?? ''} className="input">
              <option value="">{t('decisionForm.selectPlaceholder')}</option>
              {financeCompanies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="financeItNumber">{t('decisionForm.loanNumber')} <span className="text-red-500">*</span></label>
            <input id="financeItNumber" name="financeItNumber" defaultValue={defaultFinanceItNumber ?? ''} className="input" autoComplete="off" placeholder={t('decisionForm.loanNumberPlaceholder')} />
          </div>
          {hdRequired && (
            <div>
              <label className="label" htmlFor="hdReference">{t('decisionForm.hdReference')} <span className="font-normal text-gray-400">{t('decisionForm.hdReferenceOptional')}</span></label>
              <input id="hdReference" name="hdReference" value={hd} onChange={(e) => setHd(e.target.value)} className="input" autoComplete="off" placeholder={t('decisionForm.hdReferencePlaceholder')} />
              {origin && <p className="mt-1 text-xs font-medium text-brand-700">{origin === 'Home Depot lead' ? '🏬' : '🆕'} {origin === 'Home Depot lead' ? t('decisionForm.originHdLead') : t('decisionForm.originGwaCreated')}</p>}
            </div>
          )}
          <p className="text-xs text-gray-500">
            {t('decisionForm.approvalHint')}
            {hdRequired ? ` ${t('decisionForm.hdJournalHint')}` : ''}
          </p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="notes">{t('decisionForm.notes')}</label>
        <textarea id="notes" name="notes" rows={3} className="input" />
      </div>
      <SubmitButton />
    </form>
  );
}
