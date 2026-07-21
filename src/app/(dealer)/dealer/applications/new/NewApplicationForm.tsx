'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createApplicationAction, type ActionState } from '@/app/(dealer)/actions';
import { PROVINCES, CONSENT_TEXT } from '@/lib/constants';

const initial: ActionState = {};

function Err({ state, name }: { state: ActionState; name: string }) {
  const msg = state.fieldErrors?.[name];
  return msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Submitting…' : 'Submit application'}
    </button>
  );
}

export function NewApplicationForm() {
  const [state, action] = useFormState(createApplicationAction, initial);

  return (
    <form action={action} className="space-y-8">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </div>
      )}

      {/* Program */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Financing details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="province">Province</label>
            <select id="province" name="province" required className="input">
              <option value="">Select…</option>
              {PROVINCES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <Err state={state} name="province" />
          </div>
          <div>
            <label className="label" htmlFor="program">Program / product</label>
            <input id="program" name="program" required className="input" placeholder="e.g. HVAC Financing" />
            <Err state={state} name="program" />
          </div>
          <div>
            <label className="label" htmlFor="requestedAmount">Requested amount (CAD)</label>
            <input id="requestedAmount" name="requestedAmount" type="number" step="0.01" min="0" required className="input" />
            <Err state={state} name="requestedAmount" />
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="homeownershipRequired" value="true" className="rounded border-gray-300" />
          Proof of homeownership will be required for this deal
        </label>
      </section>

      {/* Applicant */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Applicant</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="applicantFirstName">First name</label>
            <input id="applicantFirstName" name="applicantFirstName" required className="input" />
            <Err state={state} name="applicantFirstName" />
          </div>
          <div>
            <label className="label" htmlFor="applicantLastName">Last name</label>
            <input id="applicantLastName" name="applicantLastName" required className="input" />
            <Err state={state} name="applicantLastName" />
          </div>
          <div>
            <label className="label" htmlFor="applicantEmail">Email</label>
            <input id="applicantEmail" name="applicantEmail" type="email" required className="input" />
            <Err state={state} name="applicantEmail" />
          </div>
          <div>
            <label className="label" htmlFor="applicantPhone">Phone</label>
            <input id="applicantPhone" name="applicantPhone" required className="input" />
            <Err state={state} name="applicantPhone" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="applicantAddress">Street address</label>
            <input id="applicantAddress" name="applicantAddress" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="applicantDob">Date of birth</label>
            <input id="applicantDob" name="applicantDob" type="date" className="input" />
          </div>
        </div>
      </section>

      {/* Sensitive */}
      <section className="card border-amber-200 bg-amber-50/40 p-6">
        <h2 className="text-base font-semibold text-gray-900">Sensitive information</h2>
        <p className="mb-4 mt-1 text-xs text-amber-700">
          The fields below are encrypted at rest and access is logged. Only collect what is
          necessary for this application.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="applicantSin">SIN (optional)</label>
            <input id="applicantSin" name="applicantSin" className="input" placeholder="000 000 000" autoComplete="off" />
            <Err state={state} name="applicantSin" />
          </div>
          <div>
            <label className="label" htmlFor="govIdNumber">Government ID number</label>
            <input id="govIdNumber" name="govIdNumber" className="input" autoComplete="off" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="bankAccount">Bank account (from void cheque / PAP)</label>
            <input id="bankAccount" name="bankAccount" className="input" placeholder="Institution / Transit / Account" autoComplete="off" />
          </div>
        </div>
      </section>

      {/* Co-applicant + financials */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Co-applicant &amp; financials</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="coApplicantName">Co-applicant name</label>
            <input id="coApplicantName" name="coApplicantName" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="coApplicantSin">Co-applicant SIN (optional)</label>
            <input id="coApplicantSin" name="coApplicantSin" className="input" autoComplete="off" />
            <Err state={state} name="coApplicantSin" />
          </div>
          <div>
            <label className="label" htmlFor="incomeAnnual">Annual income (CAD)</label>
            <input id="incomeAnnual" name="incomeAnnual" type="number" step="0.01" min="0" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="employer">Employer</label>
            <input id="employer" name="employer" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={3} className="input" />
          </div>
        </div>
      </section>

      {/* Consent */}
      <section className="card p-6">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Consent</h2>
        <div className="mb-3 max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          {CONSENT_TEXT}
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="consent" value="on" required className="mt-0.5 rounded border-gray-300" />
          <span>I confirm the applicant has provided informed consent as described above.</span>
        </label>
        <Err state={state} name="consent" />
      </section>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
