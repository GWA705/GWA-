'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { addCoApplicantAction, type ActionState } from '@/app/(dealer)/actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm disabled:opacity-60" disabled={pending}>
      {pending ? 'Adding…' : 'Add co-applicant'}
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

  if (state.ok) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">Co-applicant added.</p>
        <p className="mt-0.5">Georgian Water &amp; Air has been notified{willReset ? ' and the deal is back in review so credit can be re-checked with both applicants' : ''}.</p>
      </div>
    );
  }

  return (
    <details className="rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-base leading-none">＋</span>
        Add a co-applicant
      </summary>
      <div className="border-t border-gray-100 p-4">
        <p className="mb-3 text-xs text-gray-500">
          Adding a co-applicant changes the credit application, so the deal goes back to review for Georgian Water &amp; Air
          to re-check credit with both applicants. First and last name are required; fill in the rest you have.
        </p>
        <form action={action} className="space-y-5">
          {state.error && !Object.keys(e).length && (
            <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
          )}

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Name &amp; relationship</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <F name="coFirstName" label="First name" err={e.coFirstName} required />
              <F name="coMiddleName" label="Middle name" />
              <F name="coLastName" label="Last name" err={e.coLastName} required />
              <F name="coRelationship" label="Relationship to applicant" placeholder="Spouse, parent…" />
              <F name="coMaritalStatus" label="Marital status" />
              <F name="coDob" label="Date of birth" type="date" />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Contact &amp; SIN</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <F name="coApplicantSin" label="SIN (9 digits)" err={e.coApplicantSin} placeholder="123456789" />
              <F name="coEmail" label="Email" type="email" err={e.coEmail} />
              <F name="coPhone" label="Mobile phone" />
              <F name="coHomePhone" label="Home phone" />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Current address</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2"><F name="coAddress" label="Street address" /></div>
              <F name="coCity" label="City" />
              <F name="coProvince" label="Province" />
              <F name="coPostal" label="Postal code" />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Employment &amp; income</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className={labelCls}>Employment status
                <select name="coEmploymentStatus" className={inputCls} defaultValue="">
                  <option value="">—</option>
                  <option value="EMPLOYED">Employed</option>
                  <option value="SELF_EMPLOYED">Self-employed</option>
                  <option value="RETIRED">Retired</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <F name="coBusinessName" label="Employer" />
              <F name="coPositionTitle" label="Position / title" />
              <F name="coGrossMonthlyIncome" label="Gross monthly income ($)" type="number" />
              <F name="coTimeAtJobYears" label="Years at job" type="number" />
              <F name="coEmployerPhone" label="Employer phone" />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Government ID</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <F name="coIdType" label="ID type" placeholder="Driver's licence…" />
              <F name="coGovIdNumber" label="ID number" />
              <F name="coIdProvince" label="Issuing province" />
              <F name="coIdExpiry" label="Expiry" type="date" />
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <SubmitBtn />
            <span className="text-xs text-gray-400">Sensitive details (SIN, DOB, address, ID) are encrypted.</span>
          </div>
        </form>
      </div>
    </details>
  );
}
