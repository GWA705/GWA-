'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveConfirmationAction, type ActionState } from '@/app/(staff)/actions';
import { CONFIRMATION_PHONE } from '@/lib/constants';
import { useT } from '@/i18n/client';
import type { Confirmation } from '@prisma/client';

const QUESTIONS: { name: keyof CheckState; labelKey: string; group: 1 | 2 }[] = [
  { name: 'installedWorking', labelKey: 'q1', group: 1 },
  { name: 'performingAsRepresented', labelKey: 'q2', group: 1 },
  { name: 'receivedEverything', labelKey: 'q3', group: 1 },
  { name: 'termsAgreed', labelKey: 'q4', group: 2 },
  { name: 'signatureConfirmed', labelKey: 'q5', group: 2 },
  { name: 'notTrialOffer', labelKey: 'q6', group: 2 },
];

interface CheckState {
  installedWorking: boolean;
  performingAsRepresented: boolean;
  receivedEverything: boolean;
  termsAgreed: boolean;
  signatureConfirmed: boolean;
  notTrialOffer: boolean;
}

function Buttons({ remaining }: { remaining: number }) {
  const { pending } = useFormStatus();
  const t = useT();
  const allChecked = remaining === 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" name="intent" value="save" className="btn-secondary text-sm" disabled={pending}>
          {t('confirmationForm.saveDraft')}
        </button>
        <button
          type="submit"
          name="intent"
          value="complete"
          className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending || !allChecked}
        >
          {t('confirmationForm.confirmComplete')}
        </button>
        <button type="submit" name="intent" value="issue" className="btn-danger text-sm" disabled={pending}>
          {t('confirmationForm.markIssue')}
        </button>
      </div>
      {!allChecked && (
        <p className="text-xs font-medium text-amber-700">
          {t('confirmationForm.unlockHint', { n: remaining })}
        </p>
      )}
      <p className="text-xs text-gray-400">
        <strong>{t('confirmationForm.saveDraft')}</strong>{t('confirmationForm.saveDraftHelp')}
        <strong> {t('confirmationForm.confirmComplete')}</strong>{t('confirmationForm.confirmCompleteHelp')}
      </p>
    </div>
  );
}

export function ConfirmationForm({
  applicationId,
  data,
  applicantName,
  defaultProduct,
  defaultCity,
  defaultPhone,
  defaultAmount,
}: {
  applicationId: string;
  data: Confirmation | null;
  applicantName: string;
  defaultProduct: string;
  defaultCity: string;
  defaultPhone: string;
  defaultAmount: string;
}) {
  const t = useT();
  const [state, action] = useFormState(saveConfirmationAction, {} as ActionState);
  const [checked, setChecked] = useState<CheckState>({
    installedWorking: data?.installedWorking ?? false,
    performingAsRepresented: data?.performingAsRepresented ?? false,
    receivedEverything: data?.receivedEverything ?? false,
    termsAgreed: data?.termsAgreed ?? false,
    signatureConfirmed: data?.signatureConfirmed ?? false,
    notTrialOffer: data?.notTrialOffer ?? false,
  });
  const remaining = Object.values(checked).filter((v) => !v).length;
  const val = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));

  return (
    <form action={action} className="space-y-5 text-sm">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">{t('confirmationForm.savedMessage')}</div>}
      <input type="hidden" name="applicationId" value={applicationId} />

      {/* Header */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><label className="label">{t('confirmationForm.customer')}</label><input className="input" value={applicantName} disabled /></div>
        <div><label className="label">{t('confirmationForm.numberOfCalls')}</label><input name="numberOfCalls" type="number" min="0" defaultValue={val(data?.numberOfCalls)} className="input" /></div>
        <div><label className="label">{t('confirmationForm.product')}</label><input name="productName" defaultValue={data?.productName ?? defaultProduct} className="input" /></div>
        <div><label className="label">{t('confirmationForm.city')}</label><input name="city" defaultValue={data?.city ?? defaultCity} className="input" /></div>
        <div><label className="label">{t('confirmationForm.phone')}</label><input name="phoneNumber" defaultValue={data?.phoneNumber ?? defaultPhone} className="input" /></div>
      </div>

      <p className="rounded bg-gray-50 p-3 text-xs text-gray-600">
        {t('confirmationForm.callScript', { name: applicantName })}
      </p>

      {/* Questions 1-3 */}
      <fieldset className="space-y-2">
        {QUESTIONS.filter((q) => q.group === 1).map((q) => (
          <label key={q.name} className="flex items-start gap-2">
            <input
              type="checkbox"
              name={q.name}
              value="on"
              checked={checked[q.name]}
              onChange={(e) => setChecked((c) => ({ ...c, [q.name]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>{t(`confirmationForm.${q.labelKey}`)}</span>
          </label>
        ))}
      </fieldset>

      {/* Terms */}
      <div className="rounded border border-gray-100 p-3">
        <p className="mb-2 text-xs text-gray-600">{t('confirmationForm.termsIntro')}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><label className="label">{t('confirmationForm.financingAmount')}</label><input name="financingAmount" type="number" step="0.01" min="0" defaultValue={data?.financingAmount ? String(data.financingAmount) : defaultAmount} className="input" /></div>
          <div><label className="label">{t('confirmationForm.termMonths')}</label><input name="termMonths" type="number" min="0" defaultValue={val(data?.termMonths)} className="input" /></div>
          <div><label className="label">{t('confirmationForm.firstInstallmentAmount')}</label><input name="firstInstallmentAmount" type="number" step="0.01" min="0" defaultValue={data?.firstInstallmentAmount ? String(data.firstInstallmentAmount) : ''} className="input" /></div>
          <div><label className="label">{t('confirmationForm.firstInstallmentDate')}</label><input name="firstInstallmentDate" type="date" defaultValue={data?.firstInstallmentDate ? new Date(data.firstInstallmentDate).toISOString().slice(0, 10) : ''} className="input" /></div>
        </div>
      </div>

      {/* Questions 4-6 */}
      <fieldset className="space-y-2">
        <p className="text-xs text-gray-600">{t('confirmationForm.verifyIntro')}</p>
        {QUESTIONS.filter((q) => q.group === 2).map((q) => (
          <label key={q.name} className="flex items-start gap-2">
            <input
              type="checkbox"
              name={q.name}
              value="on"
              checked={checked[q.name]}
              onChange={(e) => setChecked((c) => ({ ...c, [q.name]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>{t(`confirmationForm.${q.labelKey}`)}</span>
          </label>
        ))}
      </fieldset>

      <p className="text-xs text-gray-500">{t('confirmationForm.closing', { phone: CONFIRMATION_PHONE })}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="label">{t('confirmationForm.specialArrangements')}</label><textarea name="specialArrangements" rows={2} defaultValue={val(data?.specialArrangements)} className="input" /></div>
        <div><label className="label">{t('confirmationForm.hdNotes')}</label><textarea name="hdNotes" rows={2} defaultValue={val(data?.hdNotes)} className="input" /></div>
      </div>
      <div><label className="label">{t('confirmationForm.issueNote')}</label><input name="issueNote" defaultValue={val(data?.issueNote)} className="input" /></div>

      <Buttons remaining={remaining} />
    </form>
  );
}
