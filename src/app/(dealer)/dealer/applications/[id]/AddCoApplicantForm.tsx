'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { addCoApplicantAction, type ActionState } from '@/app/(dealer)/actions';
import { useT } from '@/i18n/client';

function SubmitBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary text-sm disabled:opacity-60" disabled={pending}>
      {pending ? t('coApp.adding') : t('coApp.addBtn')}
    </button>
  );
}

const inputCls =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelCls = 'block text-xs font-medium text-gray-600';

function F({ name, label, type = 'text', err, placeholder, required = false }: { name: string; label: string; type?: string; err?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className={labelCls}>
      {label}{required && <span className="text-red-500"> *</span>}
      <input type={type} name={name} placeholder={placeholder} className={inputCls} />
      {err && <span className="mt-0.5 block text-xs text-red-600">{err}</span>}
    </label>
  );
}

/**
 * Dealer self-serve: add a co-applicant to an existing deal. Collects the same
 * co-applicant details the new-deal form does. Adding one sends the deal back to
 * review so GWA re-checks credit with both applicants.
 */
export function AddCoApplicantForm({ applicationId, willReset }: { applicationId: string; willReset: boolean }) {
  const [state, action] = useFormState<ActionState, FormData>(addCoApplicantAction.bind(null, applicationId), {});
  const e = state.fieldErrors ?? {};
  const t = useT();

  if (state.ok) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">{t('coApp.addedTitle')}</p>
        <p className="mt-0.5">{willReset ? t('coApp.notifiedReset') : t('coApp.notified')}</p>
      </div>
    );
  }

  return (
    <details className="rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-base leading-none">＋</span>
        {t('coApp.add')}
      </summary>
      <div className="border-t border-gray-100 p-4">
        <p className="mb-3 text-xs text-gray-500">{t('coApp.intro')}</p>
        <form action={action} className="space-y-5">
          {state.error && !Object.keys(e).length && (
            <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
          )}

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('coApp.legendName')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <F name="coFirstName" label={t('coApp.firstName')} err={e.coFirstName} required />
              <F name="coMiddleName" label={t('coApp.middleName')} />
              <F name="coLastName" label={t('coApp.lastName')} err={e.coLastName} required />
              <F name="coRelationship" label={t('coApp.relationship')} placeholder={t('coApp.relationshipPh')} />
              <F name="coMaritalStatus" label={t('coApp.maritalStatus')} />
              <F name="coDob" label={t('coApp.dob')} type="date" />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('coApp.legendContact')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <F name="coApplicantSin" label={t('coApp.sin')} err={e.coApplicantSin} placeholder="123456789" />
              <F name="coEmail" label={t('coApp.email')} type="email" err={e.coEmail} />
              <F name="coPhone" label={t('coApp.mobilePhone')} />
              <F name="coHomePhone" label={t('coApp.homePhone')} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('coApp.legendAddress')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2"><F name="coAddress" label={t('coApp.streetAddress')} /></div>
              <F name="coCity" label={t('coApp.city')} />
              <F name="coProvince" label={t('coApp.province')} />
              <F name="coPostal" label={t('coApp.postal')} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('coApp.legendEmployment')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className={labelCls}>{t('coApp.employmentStatus')}
                <select name="coEmploymentStatus" className={inputCls} defaultValue="">
                  <option value="">—</option>
                  <option value="EMPLOYED">{t('coApp.employed')}</option>
                  <option value="SELF_EMPLOYED">{t('coApp.selfEmployed')}</option>
                  <option value="RETIRED">{t('coApp.retired')}</option>
                  <option value="OTHER">{t('coApp.other')}</option>
                </select>
              </label>
              <F name="coBusinessName" label={t('coApp.employer')} />
              <F name="coPositionTitle" label={t('coApp.position')} />
              <F name="coGrossMonthlyIncome" label={t('coApp.grossMonthly')} type="number" />
              <F name="coTimeAtJobYears" label={t('coApp.yearsAtJob')} type="number" />
              <F name="coEmployerPhone" label={t('coApp.employerPhone')} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('coApp.legendId')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <F name="coIdType" label={t('coApp.idType')} placeholder={t('coApp.idTypePh')} />
              <F name="coGovIdNumber" label={t('coApp.idNumber')} />
              <F name="coIdProvince" label={t('coApp.issuingProvince')} />
              <F name="coIdExpiry" label={t('coApp.expiry')} type="date" />
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <SubmitBtn />
            <span className="text-xs text-gray-400">{t('coApp.encryptedNote')}</span>
          </div>
        </form>
      </div>
    </details>
  );
}
