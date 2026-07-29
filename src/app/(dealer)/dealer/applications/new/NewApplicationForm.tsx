'use client';

import { useState, useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createApplicationAction, type ActionState } from '@/app/(dealer)/actions';
import {
  PROVINCES,
  CONSENT_TEXT,
  PROGRAM_TYPES,
  PROGRAM_CATEGORIES,
  PHOTO_ID_TYPES,
} from '@/lib/constants';
import { formatPhone, formatPostal } from '@/lib/format';
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput';

const initial: ActionState = {};

interface Store {
  id: string;
  number: string;
  name: string | null;
}

type Method = 'TYPED' | 'PHOTO' | 'FINANCEIT';

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

const phoneFmt = (e: React.FormEvent<HTMLInputElement>) => {
  e.currentTarget.value = formatPhone(e.currentTarget.value);
};
const postalFmt = (e: React.FormEvent<HTMLInputElement>) => {
  e.currentTarget.value = formatPostal(e.currentTarget.value);
};

// Friendly labels for the error summary (keyed by form field name).
const FIELD_LABELS: Record<string, string> = {
  programType: 'Program',
  programCategory: 'Category',
  requestedAmount: 'Requested amount',
  applicantFirstName: 'First name',
  applicantLastName: 'Last name',
  applicantEmail: 'Email',
  applicantPhone: 'Phone',
  province: 'Province',
  consent: 'Consent',
  financeItNumber: 'Financing deal number',
};

// Always-required fields (independent of entry method).
const REQUIRED_FIELDS: { name: string; label: string; checkbox?: boolean }[] = [
  { name: 'programType', label: 'Program' },
  { name: 'programCategory', label: 'Category' },
  { name: 'requestedAmount', label: 'Requested amount' },
  { name: 'applicantFirstName', label: 'First name' },
  { name: 'applicantLastName', label: 'Last name' },
  { name: 'applicantEmail', label: 'Email' },
  { name: 'applicantPhone', label: 'Phone' },
  { name: 'province', label: 'Province' },
  { name: 'consent', label: 'Consent', checkbox: true },
];

function cleanMessage(msg: string): string {
  if (/enum|expected|invalid/i.test(msg)) return 'required';
  return msg.replace(/\.$/, '').toLowerCase();
}

function focusField(name: string) {
  const el =
    (document.getElementById(name) as HTMLElement | null) ??
    (document.querySelector(`[name="${name}"]`) as HTMLElement | null);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.focus({ preventScroll: true }), 300);
  }
}

const METHODS: { value: Method; title: string; blurb: string }[] = [
  { value: 'TYPED', title: 'Type it in', blurb: 'Enter the full application (fewer errors)' },
  { value: 'PHOTO', title: 'Upload a photo', blurb: 'Attach a photo of the paper application' },
  { value: 'FINANCEIT', title: 'Financing number', blurb: 'Already approved — enter the deal number' },
];

export function NewApplicationForm({ stores }: { stores: Store[] }) {
  const [state, action] = useFormState(createApplicationAction, initial);
  const [method, setMethod] = useState<Method>('TYPED');
  const typed = method === 'TYPED';
  const summaryRef = useRef<HTMLDivElement>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Merge instant client-side checks with any server-returned errors.
  const errorEntries = Object.entries({ ...(state.fieldErrors ?? {}), ...clientErrors });

  // Check required fields ourselves so we can list ALL missing ones at once,
  // instead of the browser stopping at the first empty field.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const errs: Record<string, string> = {};
    for (const f of REQUIRED_FIELDS) {
      const el = form.elements.namedItem(f.name) as HTMLInputElement | HTMLSelectElement | null;
      if (!el) continue;
      const empty = f.checkbox ? !(el as HTMLInputElement).checked : !(el.value || '').trim();
      if (empty) errs[f.name] = 'required';
    }
    if (Object.keys(errs).length > 0) {
      e.preventDefault();
      setClientErrors(errs);
      summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setClientErrors({});
    }
  }

  // When the server returns errors, scroll the summary into view.
  useEffect(() => {
    if (state.error || (state.fieldErrors && Object.keys(state.fieldErrors).length > 0)) {
      summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="entryMethod" value={method} />

      {(state.error || errorEntries.length > 0) && (
        <div ref={summaryRef} className="rounded-md border border-red-200 bg-red-50 p-4 text-sm" role="alert">
          <p className="font-semibold text-red-800">
            {errorEntries.length > 0
              ? "Please complete or fix the following before submitting:"
              : state.error}
          </p>
          {errorEntries.length > 0 && (
            <ul className="mt-2 space-y-1">
              {errorEntries.map(([name, msg]) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => focusField(name)}
                    className="text-left text-red-700 underline decoration-red-300 underline-offset-2 hover:text-red-900"
                  >
                    {FIELD_LABELS[name] ?? name} — {cleanMessage(msg)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Entry method */}
      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">How are you providing the credit application?</h2>
        <p className="mb-4 text-xs text-gray-500">Typing it in is encouraged — it means fewer errors on the customer&apos;s application.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`rounded-lg border p-4 text-left transition ${
                method === m.value
                  ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-semibold text-gray-900">{m.title}</div>
              <div className="mt-0.5 text-xs text-gray-500">{m.blurb}</div>
            </button>
          ))}
        </div>
        {method === 'PHOTO' && (
          <p className="mt-4 rounded bg-blue-50 p-3 text-sm text-blue-800">
            After you submit, open the application and upload the photo(s) under “Documents for approval.”
          </p>
        )}
        {method === 'FINANCEIT' && (
          <p className="mt-4 rounded bg-emerald-50 p-3 text-sm text-emerald-800">
            Enter the financing deal number below — the deal will be marked as approved.
          </p>
        )}
      </section>

      {/* Financing details */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Financing details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="programType">Program</label>
            <select id="programType" name="programType" className="input">
              <option value="">Select…</option>
              {PROGRAM_TYPES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="programType" />
          </div>
          <div>
            <label className="label" htmlFor="programCategory">Category</label>
            <select id="programCategory" name="programCategory" className="input">
              <option value="">Select…</option>
              {PROGRAM_CATEGORIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="programCategory" />
          </div>
          <div>
            <label className="label" htmlFor="requestedAmount">Requested amount (CAD)</label>
            <input id="requestedAmount" name="requestedAmount" type="number" step="0.01" min="0" className="input" />
            <Err state={state} name="requestedAmount" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="financeItNumber">Financing deal number {method === 'FINANCEIT' ? '' : <span className="font-normal text-gray-400">(if approved)</span>}</label>
            <input id="financeItNumber" name="financeItNumber" maxLength={60} className="input" placeholder="Finance company deal #" autoComplete="off" />
            <p className="mt-1 text-xs text-gray-400">Entering this indicates the deal is already approved.</p>
            <Err state={state} name="financeItNumber" />
          </div>
          <div>
            <label className="label" htmlFor="financingNote">Financing note</label>
            <textarea id="financingNote" name="financingNote" rows={2} className="input" placeholder="What kind of financing deal or promotion would you like with this?" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="financeReference">Finance reference #</label><input id="financeReference" name="financeReference" className="input" autoComplete="off" placeholder="If applicable" /></div>
          <div><label className="label" htmlFor="hdReference">HD Customer #</label><input id="hdReference" name="hdReference" className="input" autoComplete="off" placeholder="If applicable" /></div>
        </div>
      </section>

      {/* Deal details */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Deal details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="dateOfSale">Date of sale</label><input id="dateOfSale" name="dateOfSale" type="date" className="input" /></div>
          <div><label className="label" htmlFor="installationDate">Installation date</label><input id="installationDate" name="installationDate" type="date" className="input" /></div>
          <div>
            <label className="label" htmlFor="homeDepotStoreId">Home Depot store</label>
            <select id="homeDepotStoreId" name="homeDepotStoreId" className="input" disabled={stores.length === 0}>
              <option value="">{stores.length === 0 ? 'No stores assigned' : 'Select…'}</option>
              {stores.map((s) => (<option key={s.id} value={s.id}>{s.number}{s.name ? ` — ${s.name}` : ''}</option>))}
            </select>
            {stores.length === 0 && <p className="mt-1 text-xs text-gray-400">Ask an admin to assign your store(s).</p>}
          </div>
        </div>
      </section>

      {/* Applicant (always) */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Applicant</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="applicantFirstName">First name</label><input id="applicantFirstName" name="applicantFirstName" className="input" /><Err state={state} name="applicantFirstName" /></div>
          <div><label className="label" htmlFor="applicantLastName">Last name</label><input id="applicantLastName" name="applicantLastName" className="input" /><Err state={state} name="applicantLastName" /></div>
          {typed && <div><label className="label" htmlFor="middleName">Middle name <span className="font-normal text-gray-400">(optional)</span></label><input id="middleName" name="middleName" className="input" /></div>}
          <div><label className="label" htmlFor="applicantDob">Date of birth</label><input id="applicantDob" name="applicantDob" type="date" className="input" /></div>
          <div><label className="label" htmlFor="applicantEmail">Email</label><input id="applicantEmail" name="applicantEmail" type="email" className="input" /><Err state={state} name="applicantEmail" /></div>
          <div><label className="label" htmlFor="applicantPhone">Mobile phone</label><input id="applicantPhone" name="applicantPhone" className="input" inputMode="numeric" maxLength={12} placeholder="705-716-2111" onInput={phoneFmt} /><Err state={state} name="applicantPhone" /></div>
          {typed && <div><label className="label" htmlFor="homePhone">Home phone <span className="font-normal text-gray-400">(optional)</span></label><input id="homePhone" name="homePhone" className="input" inputMode="numeric" maxLength={12} placeholder="705-716-2111" onInput={phoneFmt} /></div>}
          {typed && (
            <div>
              <label className="label" htmlFor="maritalStatus">Marital status</label>
              <select id="maritalStatus" name="maritalStatus" className="input">
                <option value="">Select…</option>
                <option>Single</option><option>Married</option><option>Common-law</option>
                <option>Separated</option><option>Divorced</option><option>Widowed</option>
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Address (always) */}
      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Address</h2>
        <p className="mb-4 text-xs text-gray-400">Start typing the street address and pick a suggestion to fill in the rest.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="applicantAddress">Street address</label>
            <AddressAutocompleteInput id="applicantAddress" name="applicantAddress" className="input" cityId="city" provinceId="province" postalId="postalCode" />
          </div>
          {typed && <div><label className="label" htmlFor="city">City</label><input id="city" name="city" className="input" /></div>}
          <div>
            <label className="label" htmlFor="province">Province</label>
            <select id="province" name="province" className="input">
              <option value="">Select…</option>
              {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="province" />
          </div>
          {typed && <div><label className="label" htmlFor="postalCode">Postal code</label><input id="postalCode" name="postalCode" className="input" placeholder="L0L 2T0" maxLength={7} onInput={postalFmt} /></div>}
        </div>

        {typed && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="housingStatus">Housing status</label>
                <select id="housingStatus" name="housingStatus" className="input">
                  <option value="">Select…</option>
                  <option value="OWN">Own</option><option value="RENT">Rent</option><option value="OTHER">Other</option>
                </select>
              </div>
              <div><label className="label" htmlFor="monthlyHousingCost">Monthly housing cost</label><input id="monthlyHousingCost" name="monthlyHousingCost" type="number" step="0.01" min="0" className="input" /></div>
              <div><label className="label" htmlFor="yearsAtAddress">Years at this address</label><input id="yearsAtAddress" name="yearsAtAddress" type="number" min="0" className="input" /></div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">Additional addresses (optional)</summary>
              <div className="mt-3 space-y-4">
                {[
                  { key: 'mailing', label: 'Mailing address' },
                  { key: 'previous', label: 'Previous address' },
                  { key: 'worksite', label: 'Work-site (install) address' },
                ].map((a) => (
                  <div key={a.key} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2"><label className="label">{a.label}</label><input name={`${a.key}Address`} className="input" /></div>
                    <div><label className="label">City</label><input name={`${a.key}City`} className="input" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label">Prov.</label><input name={`${a.key}Province`} className="input" /></div>
                      <div><label className="label">Postal</label><input name={`${a.key}Postal`} className="input" maxLength={7} onInput={postalFmt} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </section>

      {typed && (
        <>
          {/* Borrower identification */}
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Borrower identification</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="idType">Photo ID type</label>
                <select id="idType" name="idType" className="input">
                  <option value="">Select…</option>
                  {PHOTO_ID_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div><label className="label" htmlFor="govIdNumber">Photo ID number</label><input id="govIdNumber" name="govIdNumber" className="input" autoComplete="off" /></div>
              <div>
                <label className="label" htmlFor="idProvince">Province of issue</label>
                <select id="idProvince" name="idProvince" className="input">
                  <option value="">Select…</option>
                  {PROVINCES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div><label className="label" htmlFor="idExpiry">Expiry date</label><input id="idExpiry" name="idExpiry" type="date" className="input" /></div>
            </div>
          </section>

          {/* Employment & income */}
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Employment &amp; income</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="businessName">Employer / business name</label><input id="businessName" name="businessName" className="input" /></div>
              <div><label className="label" htmlFor="positionTitle">Position title</label><input id="positionTitle" name="positionTitle" className="input" /></div>
              <div><label className="label" htmlFor="employerAddress">Employer address <span className="font-normal text-gray-400">(optional)</span></label><input id="employerAddress" name="employerAddress" className="input" /></div>
              <div><label className="label" htmlFor="employerPhone">Employer phone <span className="font-normal text-gray-400">(optional)</span></label><input id="employerPhone" name="employerPhone" className="input" inputMode="numeric" maxLength={12} placeholder="705-716-2111" onInput={phoneFmt} /></div>
              <div><label className="label" htmlFor="grossMonthlyIncome">Gross monthly income</label><input id="grossMonthlyIncome" name="grossMonthlyIncome" type="number" step="0.01" min="0" className="input" /></div>
              <div><label className="label" htmlFor="timeAtJobYears">Time at job (years)</label><input id="timeAtJobYears" name="timeAtJobYears" type="number" min="0" className="input" /></div>
              <div>
                <label className="label" htmlFor="employmentStatus">Employment status</label>
                <select id="employmentStatus" name="employmentStatus" className="input">
                  <option value="">Select…</option>
                  <option value="EMPLOYED">Employed</option><option value="SELF_EMPLOYED">Self-employed</option><option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </section>

          {/* Co-applicant */}
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Co-applicant &amp; notes</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="coApplicantName">Co-applicant name</label><input id="coApplicantName" name="coApplicantName" className="input" /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={3} className="input" /></div>
            </div>
          </section>
        </>
      )}

      {/* Consent (always) */}
      <section className="card p-6">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Consent</h2>
        <div className="mb-3 max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">{CONSENT_TEXT}</div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="consent" value="on" className="mt-0.5 rounded border-gray-300" />
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
