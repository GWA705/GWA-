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
  PAYMENT_METHODS,
  SOAP_OPTIONS,
} from '@/lib/constants';
import type { PaymentMethod } from '@prisma/client';
import { formatPhone, formatPostal } from '@/lib/format';
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput';
import { DateOfBirthInput } from '@/components/DateOfBirthInput';
import { SplitPaymentInput } from '@/components/SplitPaymentInput';
import { ProductPicker } from '@/components/ProductPicker';

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
  applicantAddress: 'Street address',
  province: 'Province',
  dateOfSale: 'Date of sale',
  installationDate: 'Installation date',
  homeDepotStoreId: 'Home Depot store',
  consent: 'Consent',
  paymentMethod: 'Payment type',
  financeItNumber: 'Financing deal number',
  salespersonName: "Salesperson's name",
  installerName: "Installer's name",
  soapIncluded: 'SOAP included',
  productsSold: 'Product(s) sold',
};

type RequiredField = { name: string; label: string; checkbox?: boolean };

// Always-required fields (independent of entry method).
const BASE_REQUIRED: RequiredField[] = [
  { name: 'programType', label: 'Program' },
  { name: 'programCategory', label: 'Category' },
  { name: 'requestedAmount', label: 'Requested amount' },
  { name: 'applicantFirstName', label: 'First name' },
  { name: 'applicantLastName', label: 'Last name' },
  { name: 'applicantEmail', label: 'Email' },
  { name: 'applicantPhone', label: 'Phone' },
  { name: 'applicantAddress', label: 'Street address' },
  { name: 'province', label: 'Province' },
  // Sales details — required on every entry method.
  { name: 'salespersonName', label: "Salesperson's name" },
  { name: 'installerName', label: "Installer's name" },
  { name: 'soapIncluded', label: 'SOAP included' },
  { name: 'consent', label: 'Consent', checkbox: true },
];

// Extra fields required for the Express (payment-arranged) path, where the deal
// is submitted as already approved: the full deal details (dates + store). The
// FinanceIT number is required only when the payment type is FinanceIT (added
// separately). Home Depot store only when the dealer has stores.
const FINANCEIT_EXTRA: RequiredField[] = [
  { name: 'dateOfSale', label: 'Date of sale' },
  { name: 'installationDate', label: 'Installation date' },
  { name: 'homeDepotStoreId', label: 'Home Depot store' },
];

// Borrower identification is mandatory on the typed (Priority) application.
const TYPED_EXTRA: RequiredField[] = [
  { name: 'idType', label: 'Photo ID type' },
  { name: 'govIdNumber', label: 'Photo ID number' },
  { name: 'idProvince', label: 'Province of issue' },
  { name: 'idExpiry', label: 'ID expiry date' },
  { name: 'employerAddress', label: 'Employer address' },
  { name: 'employerPhone', label: 'Employer phone' },
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

// Three ways to process a new customer, ranked by speed and colour-coded.
const METHODS: {
  value: Method;
  rank: string;
  icon: string; // emoji shown in the badge
  title: string;
  blurb: string;
  action: string; // call-to-action shown on the button when not selected
  badge: string; // badge colour
  selected: string; // selected card border + fill
  dot: string; // selected radio indicator fill
  focus: string; // focus ring colour
}[] = [
  {
    value: 'FINANCEIT',
    rank: 'Express',
    icon: '🚀',
    title: 'Deal already approved',
    blurb: 'Paying by cash, cheque, credit card — or already financed.',
    action: 'Use express option',
    badge: 'bg-green-100 text-green-800',
    selected: 'border-green-600 bg-green-50 ring-2 ring-green-600/40',
    dot: 'bg-green-600',
    focus: 'focus-visible:ring-green-500',
  },
  {
    value: 'TYPED',
    rank: 'Priority',
    icon: '⚡',
    title: 'Type in the details',
    blurb: 'New application — type the customer’s details for GWA to submit.',
    action: 'Use priority option',
    badge: 'bg-blue-100 text-blue-800',
    selected: 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/40',
    dot: 'bg-blue-600',
    focus: 'focus-visible:ring-blue-500',
  },
  {
    value: 'PHOTO',
    rank: 'Standard',
    icon: '📄',
    title: 'Upload documents',
    blurb: 'Send the application and bill of sale — GWA takes it from there.',
    action: 'Use standard option',
    badge: 'bg-amber-100 text-amber-800',
    selected: 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/40',
    dot: 'bg-amber-500',
    focus: 'focus-visible:ring-amber-500',
  },
];

export function NewApplicationForm({
  stores,
  products,
}: {
  stores: Store[];
  products: { id: string; name: string; journalName?: string | null; promoted?: boolean }[];
}) {
  const [state, action] = useFormState(createApplicationAction, initial);
  const [method, setMethod] = useState<Method>('TYPED');
  const [payment, setPayment] = useState<PaymentMethod>('FINANCEIT');
  const typed = method === 'TYPED';
  const express = method === 'FINANCEIT';
  // The FinanceIT approval number is only needed when the Express deal was
  // financed through FinanceIT.
  const needsFinanceNumber = express && payment === 'FINANCEIT';
  const summaryRef = useRef<HTMLDivElement>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [taxExempt, setTaxExempt] = useState(false);
  const [amount, setAmount] = useState('');
  // Entering a co-applicant first name opens the full co-applicant questionnaire.
  const [coFirstName, setCoFirstName] = useState('');
  const hasCoApplicant = coFirstName.trim().length > 0;

  // Merge instant client-side checks with any server-returned errors.
  const errorEntries = Object.entries({ ...(state.fieldErrors ?? {}), ...clientErrors });
  // Set of field names currently in error, used to outline the inputs in red.
  const errorNames = new Set(errorEntries.map(([name]) => name));

  // The whole form's inputs are outlined in the selected method's colour so the
  // dealer can see which areas belong to their choice — outline only, no fill.
  const METHOD_RING: Record<Method, string> = {
    FINANCEIT: 'ring-green-400 focus:ring-green-500',
    TYPED: 'ring-blue-400 focus:ring-blue-500',
    PHOTO: 'ring-amber-400 focus:ring-amber-500',
  };
  // Outline an input: red (with a light fill) when it has an error, otherwise
  // the selected method's colour.
  const fieldCls = (name: string, base = 'input') =>
    errorNames.has(name) ? `${base} bg-red-50 ring-2 ring-red-400` : `${base} ${METHOD_RING[method]}`;

  // Fields required for the current entry method. Express requires full deal
  // details (and the FinanceIT number only when paid via FinanceIT).
  const requiredFields: RequiredField[] = [
    ...BASE_REQUIRED,
    ...(express ? FINANCEIT_EXTRA.filter((f) => f.name !== 'homeDepotStoreId' || stores.length > 0) : []),
    ...(needsFinanceNumber ? [{ name: 'financeItNumber', label: 'Financing deal number' }] : []),
    ...(method === 'TYPED' ? TYPED_EXTRA : []),
  ];

  // Check required fields ourselves so we can list ALL missing ones at once,
  // instead of the browser stopping at the first empty field.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const errs: Record<string, string> = {};
    for (const f of requiredFields) {
      const el = form.elements.namedItem(f.name) as HTMLInputElement | HTMLSelectElement | null;
      if (!el) continue;
      const empty = f.checkbox ? !(el as HTMLInputElement).checked : !(el.value || '').trim();
      if (empty) errs[f.name] = 'required';
    }
    // Products: require at least one — a checked box or a typed "Other" entry.
    const productBoxes = form.querySelectorAll('input[name="productsSold"]');
    const otherEl = form.elements.namedItem('productsSoldOther') as HTMLInputElement | null;
    const anyChecked = Array.from(productBoxes).some((el) => (el as HTMLInputElement).checked);
    const anyOther = !!(otherEl?.value || '').trim();
    if (productBoxes.length > 0 && !anyChecked && !anyOther) {
      errs['productsSold'] = 'required';
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
      <input type="hidden" name="paymentMethod" value={express ? payment : ''} />

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
        <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-800">
          Start here
        </span>
        <h2 className="mb-1 text-base font-semibold text-gray-900">Three choices to process a new customer</h2>
        <p className="mb-4 text-xs text-gray-500">Tap the option that fits — faster options are at the top.</p>
        <div role="radiogroup" aria-label="How to process this customer" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {METHODS.map((m, i) => {
            const active = method === m.value;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMethod(m.value)}
                className={`group relative flex cursor-pointer flex-col rounded-xl border-2 p-4 pr-10 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${m.focus} ${
                  active ? m.selected : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {/* Radio-style selection indicator */}
                <span
                  className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                    active ? `${m.dot} border-transparent text-white` : 'border-gray-300 bg-white text-transparent group-hover:border-gray-400'
                  }`}
                  aria-hidden
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className={`mb-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${m.badge}`}>
                  {i + 1} · <span aria-hidden>{m.icon}</span> {m.rank}
                </span>
                <div className="text-base font-bold leading-tight text-gray-900">{m.title}</div>
                <div className="mt-1 text-xs text-gray-500">{m.blurb}</div>
                <span className={`mt-auto pt-3 text-xs font-semibold ${active ? 'text-gray-700' : 'text-brand-600 group-hover:text-brand-700'}`}>
                  {active ? '✓ Selected' : `${m.action} →`}
                </span>
              </button>
            );
          })}
        </div>
        {method === 'PHOTO' && (
          <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
            After you submit, open the application and upload the customer&apos;s application and bill of sale
            under “Documents for approval.”
          </p>
        )}
        {express && (
          <div className="mt-4 rounded-lg bg-green-50 p-4 ring-1 ring-green-200">
            <p className="label mb-2 text-green-900">How did the customer pay?</p>
            <div role="radiogroup" aria-label="Payment type" className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((p) => {
                const active = payment === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPayment(p.value)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${
                      active
                        ? 'bg-green-600 text-white ring-green-600'
                        : 'bg-white text-gray-700 ring-gray-300 hover:ring-green-400'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {errorNames.has('paymentMethod') && (
              <p className="mt-2 text-xs text-red-600">Select how the customer paid.</p>
            )}
            <p className="mt-3 text-sm text-green-800">
              {needsFinanceNumber
                ? 'Enter your FinanceIT loan number in Financing details below — the deal will be marked approved.'
                : `Paid by ${PAYMENT_METHODS.find((p) => p.value === payment)?.label}. The deal will be marked approved and sent to GWA to produce the HD paperwork.`}
            </p>
          </div>
        )}
      </section>

      {/* Financing details */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Financing details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="programType">Program</label>
            <select id="programType" name="programType" className={fieldCls('programType')}>
              <option value="">Select…</option>
              {PROGRAM_TYPES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="programType" />
          </div>
          <div>
            <label className="label" htmlFor="programCategory">Category</label>
            <select id="programCategory" name="programCategory" className={fieldCls('programCategory')}>
              <option value="">Select…</option>
              {PROGRAM_CATEGORIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="programCategory" />
          </div>
          <div>
            <label className="label" htmlFor="requestedAmount">Requested amount (CAD)</label>
            <input id="requestedAmount" name="requestedAmount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldCls('requestedAmount')} />
            <Err state={state} name="requestedAmount" />
          </div>
        </div>

        <div className="mt-4">
          <SplitPaymentInput total={Number(amount) || 0} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* The FinanceIT number only applies when the deal was financed. It is
              hidden for Express deals paid another way (cash/cheque/CC/HDCC). */}
          {!(express && !needsFinanceNumber) && (
            <div className={needsFinanceNumber ? 'rounded-lg bg-green-50 p-3 ring-1 ring-green-300' : ''}>
              <label className="label" htmlFor="financeItNumber">
                Financing deal number{' '}
                {needsFinanceNumber
                  ? <span className="font-semibold text-green-700">← enter your FinanceIT number here</span>
                  : <span className="font-normal text-gray-400">(if applicable)</span>}
              </label>
              <input
                id="financeItNumber"
                name="financeItNumber"
                maxLength={60}
                className={
                  errorNames.has('financeItNumber')
                    ? 'input bg-red-50 ring-2 ring-red-400'
                    : needsFinanceNumber
                      ? 'input bg-white ring-2 ring-green-400 focus:ring-green-500'
                      : `input ${METHOD_RING[method]}`
                }
                placeholder={needsFinanceNumber ? 'FinanceIT loan number' : 'If applicable'}
                autoComplete="off"
              />
              {needsFinanceNumber ? (
                <p className="mt-1 text-xs text-green-700">
                  Copy the approval number from your FinanceIT portal (for example <span className="font-mono font-semibold">7779477</span>). Double-check it matches before submitting — entering it marks the deal approved.
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">Entering this indicates the deal is already approved.</p>
              )}
              <Err state={state} name="financeItNumber" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="financingNote">Financing note</label>
            <textarea id="financingNote" name="financingNote" rows={2} className={fieldCls('')} placeholder="What kind of financing deal or promotion would you like with this?" />
          </div>
        </div>

      </section>

      {/* Deal details */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Deal details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="dateOfSale">Date of sale</label><input id="dateOfSale" name="dateOfSale" type="date" className={fieldCls('dateOfSale')} /><Err state={state} name="dateOfSale" /></div>
          <div><label className="label" htmlFor="installationDate">Installation date</label><input id="installationDate" name="installationDate" type="date" className={fieldCls('installationDate')} /><Err state={state} name="installationDate" /></div>
          <div>
            <label className="label" htmlFor="homeDepotStoreId">Home Depot store</label>
            <select id="homeDepotStoreId" name="homeDepotStoreId" className={fieldCls('homeDepotStoreId')} disabled={stores.length === 0}>
              <option value="">{stores.length === 0 ? 'No stores assigned' : 'Select…'}</option>
              {stores.map((s) => (<option key={s.id} value={s.id}>{s.number}{s.name ? ` — ${s.name}` : ''}</option>))}
            </select>
            {stores.length === 0 && <p className="mt-1 text-xs text-gray-400">Ask an admin to assign your store(s).</p>}
          </div>
        </div>
      </section>

      {/* Sales details — flow into the sales journal. Optional. */}
      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Sales details</h2>
        <p className="mb-4 text-xs text-gray-500">Required — these fill the sales journal.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="salespersonName">Salesperson&apos;s name</label><input id="salespersonName" name="salespersonName" className={fieldCls('')} /></div>
          <div><label className="label" htmlFor="installerName">Installer&apos;s name</label><input id="installerName" name="installerName" className={fieldCls('')} /></div>
          <div>
            <label className="label" htmlFor="soapIncluded">SOAP included</label>
            <select id="soapIncluded" name="soapIncluded" className={fieldCls('')}>
              <option value="">—</option>
              {SOAP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <span className="label">Product(s) sold</span>
          <div className="mt-1">
            {/* Searchable chip picker. Anything typed under "Other" on more than
                two deals is promoted onto this dealer's list automatically. */}
            <ProductPicker products={products} />
          </div>
        </div>
      </section>

      {/* Applicant (always) */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Applicant</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="applicantFirstName">First name</label><input id="applicantFirstName" name="applicantFirstName" className={fieldCls('applicantFirstName')} /><Err state={state} name="applicantFirstName" /></div>
          <div><label className="label" htmlFor="applicantLastName">Last name</label><input id="applicantLastName" name="applicantLastName" className={fieldCls('applicantLastName')} /><Err state={state} name="applicantLastName" /></div>
          {typed && <div><label className="label" htmlFor="middleName">Middle name <span className="font-normal text-gray-400">(optional)</span></label><input id="middleName" name="middleName" className={fieldCls('')} /></div>}
          {/* Express deals are already approved, so no date of birth is needed. */}
          {!express && <div><label className="label" htmlFor="applicantDob">Date of birth</label><DateOfBirthInput name="applicantDob" id="applicantDob" invalid={errorNames.has('applicantDob')} /><Err state={state} name="applicantDob" /></div>}
          <div><label className="label" htmlFor="applicantEmail">Email</label><input id="applicantEmail" name="applicantEmail" type="email" className={fieldCls('applicantEmail')} /><Err state={state} name="applicantEmail" /></div>
          <div><label className="label" htmlFor="applicantPhone">Mobile phone</label><input id="applicantPhone" name="applicantPhone" className={fieldCls('applicantPhone')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /><Err state={state} name="applicantPhone" /></div>
          {typed && <div><label className="label" htmlFor="homePhone">Home phone <span className="font-normal text-gray-400">(optional)</span></label><input id="homePhone" name="homePhone" className={fieldCls('')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /></div>}
          {typed && (
            <div>
              <label className="label" htmlFor="maritalStatus">Marital status</label>
              <select id="maritalStatus" name="maritalStatus" className={fieldCls('')}>
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
            <AddressAutocompleteInput id="applicantAddress" name="applicantAddress" className={fieldCls('applicantAddress')} cityId="city" provinceId="province" postalId="postalCode" />
            <Err state={state} name="applicantAddress" />
          </div>
          <div><label className="label" htmlFor="city">City</label><input id="city" name="city" className={fieldCls('')} /></div>
          <div>
            <label className="label" htmlFor="province">Province</label>
            <select id="province" name="province" className={fieldCls('province')}>
              <option value="">Select…</option>
              {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="province" />
          </div>
          <div><label className="label" htmlFor="postalCode">Postal code</label><input id="postalCode" name="postalCode" className={fieldCls('')} placeholder="L0L 2T0" maxLength={7} onInput={postalFmt} /></div>
        </div>

        {typed && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="housingStatus">Housing status</label>
                <select id="housingStatus" name="housingStatus" className={fieldCls('')}>
                  <option value="">Select…</option>
                  <option value="OWN">Own</option><option value="RENT">Rent</option><option value="OTHER">Other</option>
                </select>
              </div>
              <div><label className="label" htmlFor="monthlyHousingCost">Monthly housing cost</label><input id="monthlyHousingCost" name="monthlyHousingCost" type="number" step="0.01" min="0" className={fieldCls('')} /></div>
              <div><label className="label" htmlFor="yearsAtAddress">Years at this address</label><input id="yearsAtAddress" name="yearsAtAddress" type="number" min="0" className={fieldCls('')} /></div>
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
                    <div className="sm:col-span-2"><label className="label">{a.label}</label><input name={`${a.key}Address`} className={fieldCls('')} /></div>
                    <div><label className="label">City</label><input name={`${a.key}City`} className={fieldCls('')} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label">Prov.</label><input name={`${a.key}Province`} className={fieldCls('')} /></div>
                      <div><label className="label">Postal</label><input name={`${a.key}Postal`} className={fieldCls('')} maxLength={7} onInput={postalFmt} /></div>
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
                <select id="idType" name="idType" className={fieldCls('')}>
                  <option value="">Select…</option>
                  {PHOTO_ID_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div><label className="label" htmlFor="govIdNumber">Photo ID number</label><input id="govIdNumber" name="govIdNumber" className={fieldCls('')} autoComplete="off" /></div>
              <div>
                <label className="label" htmlFor="idProvince">Province of issue</label>
                <select id="idProvince" name="idProvince" className={fieldCls('')}>
                  <option value="">Select…</option>
                  {PROVINCES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div><label className="label" htmlFor="idExpiry">Expiry date</label><input id="idExpiry" name="idExpiry" type="date" className={fieldCls('')} /></div>
            </div>
          </section>

          {/* Employment & income */}
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Employment &amp; income</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="businessName">Employer / business name</label><input id="businessName" name="businessName" className={fieldCls('')} /></div>
              <div><label className="label" htmlFor="positionTitle">Position title</label><input id="positionTitle" name="positionTitle" className={fieldCls('')} /></div>
              <div><label className="label" htmlFor="employerAddress">Employer address</label><AddressAutocompleteInput id="employerAddress" name="employerAddress" className={fieldCls('employerAddress')} placeholder="Start typing the address…" /><Err state={state} name="employerAddress" /></div>
              <div><label className="label" htmlFor="employerPhone">Employer phone</label><input id="employerPhone" name="employerPhone" className={fieldCls('employerPhone')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /><Err state={state} name="employerPhone" /></div>
              <div><label className="label" htmlFor="grossMonthlyIncome">Gross monthly income</label><input id="grossMonthlyIncome" name="grossMonthlyIncome" type="number" step="0.01" min="0" className={fieldCls('')} /></div>
              <div><label className="label" htmlFor="timeAtJobYears">Time at job (years)</label><input id="timeAtJobYears" name="timeAtJobYears" type="number" min="0" className={fieldCls('')} /></div>
              <div>
                <label className="label" htmlFor="employmentStatus">Employment status</label>
                <select id="employmentStatus" name="employmentStatus" className={fieldCls('')}>
                  <option value="">Select…</option>
                  <option value="EMPLOYED">Employed</option><option value="SELF_EMPLOYED">Self-employed</option><option value="RETIRED">Retired</option><option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </section>

          {/* Co-applicant */}
          <section className="card p-6">
            <h2 className="mb-1 text-base font-semibold text-gray-900">Co-applicant</h2>
            <p className="mb-4 text-xs text-gray-400">
              Optional. Enter a co-applicant first name to open the full set of questions — a co-applicant needs the same details as the main applicant.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="coFirstName">Co-applicant first name</label>
                <input
                  id="coFirstName"
                  name="coFirstName"
                  className={fieldCls('')}
                  value={coFirstName}
                  onChange={(e) => setCoFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="coLastName">Co-applicant last name</label>
                <input id="coLastName" name="coLastName" className={fieldCls('')} />
              </div>
            </div>

            {hasCoApplicant && (
              <div className="mt-5 space-y-5 border-t border-gray-100 pt-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><label className="label" htmlFor="coMiddleName">Middle name <span className="font-normal text-gray-400">(optional)</span></label><input id="coMiddleName" name="coMiddleName" className={fieldCls('')} /></div>
                  <div><label className="label" htmlFor="coRelationship">Relationship to applicant</label><input id="coRelationship" name="coRelationship" className={fieldCls('')} placeholder="e.g. Spouse" /></div>
                  <div><label className="label" htmlFor="coDob">Date of birth</label><DateOfBirthInput name="coDob" id="coDob" invalid={errorNames.has('coDob')} /><Err state={state} name="coDob" /></div>
                  <div>
                    <label className="label" htmlFor="coMaritalStatus">Marital status</label>
                    <select id="coMaritalStatus" name="coMaritalStatus" className={fieldCls('')}>
                      <option value="">Select…</option>
                      <option>Single</option><option>Married</option><option>Common-law</option>
                      <option>Separated</option><option>Divorced</option><option>Widowed</option>
                    </select>
                  </div>
                  <div><label className="label" htmlFor="coEmail">Email</label><input id="coEmail" name="coEmail" type="email" className={fieldCls('')} /></div>
                  <div><label className="label" htmlFor="coPhone">Mobile phone</label><input id="coPhone" name="coPhone" className={fieldCls('')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /></div>
                  <div><label className="label" htmlFor="coHomePhone">Home phone <span className="font-normal text-gray-400">(optional)</span></label><input id="coHomePhone" name="coHomePhone" className={fieldCls('')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /></div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Co-applicant address</h3>
                  <p className="mb-3 text-xs text-gray-400">Leave blank if the co-applicant lives at the same address as the applicant.</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="label" htmlFor="coAddress">Street address</label>
                      <AddressAutocompleteInput id="coAddress" name="coAddress" className={fieldCls('')} cityId="coCity" provinceId="coProvince" postalId="coPostal" />
                    </div>
                    <div><label className="label" htmlFor="coCity">City</label><input id="coCity" name="coCity" className={fieldCls('')} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label" htmlFor="coProvince">Province</label>
                        <select id="coProvince" name="coProvince" className={fieldCls('')}>
                          <option value="">Select…</option>
                          {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.value}</option>))}
                        </select>
                      </div>
                      <div><label className="label" htmlFor="coPostal">Postal</label><input id="coPostal" name="coPostal" className={fieldCls('')} maxLength={7} onInput={postalFmt} /></div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Co-applicant identification</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="coIdType">Photo ID type</label>
                      <select id="coIdType" name="coIdType" className={fieldCls('')}>
                        <option value="">Select…</option>
                        {PHOTO_ID_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                      </select>
                    </div>
                    <div><label className="label" htmlFor="coGovIdNumber">Photo ID number</label><input id="coGovIdNumber" name="coGovIdNumber" className={fieldCls('')} autoComplete="off" /></div>
                    <div>
                      <label className="label" htmlFor="coIdProvince">Province of issue</label>
                      <select id="coIdProvince" name="coIdProvince" className={fieldCls('')}>
                        <option value="">Select…</option>
                        {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                      </select>
                    </div>
                    <div><label className="label" htmlFor="coIdExpiry">Expiry date</label><input id="coIdExpiry" name="coIdExpiry" type="date" className={fieldCls('')} /></div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Co-applicant employment &amp; income</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><label className="label" htmlFor="coBusinessName">Employer / business name</label><input id="coBusinessName" name="coBusinessName" className={fieldCls('')} /></div>
                    <div><label className="label" htmlFor="coPositionTitle">Position title</label><input id="coPositionTitle" name="coPositionTitle" className={fieldCls('')} /></div>
                    <div><label className="label" htmlFor="coEmployerAddress">Employer address <span className="font-normal text-gray-400">(optional)</span></label><input id="coEmployerAddress" name="coEmployerAddress" className={fieldCls('')} /></div>
                    <div><label className="label" htmlFor="coEmployerPhone">Employer phone <span className="font-normal text-gray-400">(optional)</span></label><input id="coEmployerPhone" name="coEmployerPhone" className={fieldCls('')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /></div>
                    <div><label className="label" htmlFor="coGrossMonthlyIncome">Gross monthly income</label><input id="coGrossMonthlyIncome" name="coGrossMonthlyIncome" type="number" step="0.01" min="0" className={fieldCls('')} /></div>
                    <div><label className="label" htmlFor="coTimeAtJobYears">Time at job (years)</label><input id="coTimeAtJobYears" name="coTimeAtJobYears" type="number" min="0" className={fieldCls('')} /></div>
                    <div>
                      <label className="label" htmlFor="coEmploymentStatus">Employment status</label>
                      <select id="coEmploymentStatus" name="coEmploymentStatus" className={fieldCls('')}>
                        <option value="">Select…</option>
                        <option value="EMPLOYED">Employed</option><option value="SELF_EMPLOYED">Self-employed</option><option value="RETIRED">Retired</option><option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Notes */}
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Notes</h2>
            <div><label className="label" htmlFor="notes">Notes <span className="font-normal text-gray-400">(optional)</span></label><textarea id="notes" name="notes" rows={3} className={fieldCls('')} /></div>
          </section>
        </>
      )}

      {/* First Nations tax exemption (always available) */}
      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">First Nations tax exemption</h2>
        <p className="mb-3 text-xs text-gray-500">For a status First Nations customer. The reviewer verifies the status card and registers the exemption with Home Depot before payment.</p>
        <label className="flex items-start gap-2 rounded p-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="taxExempt"
            value="on"
            checked={taxExempt}
            onChange={(e) => setTaxExempt(e.target.checked)}
            className="mt-0.5 rounded border-gray-300"
          />
          <span>This customer is tax-exempt (has a valid Certificate of Indian Status)</span>
        </label>
        {taxExempt && (
          <div className="mt-3 space-y-4 border-t border-gray-100 pt-4">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="deliveredToReserve" value="on" className="mt-0.5 rounded border-gray-300" />
              <span>Delivered / installed on a reserve <span className="text-gray-400">(full GST + provincial exemption; otherwise the provincial portion only)</span></span>
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="statusCardNumber">Status card number <span className="font-normal text-gray-400">(can be added later)</span></label>
                <input id="statusCardNumber" name="statusCardNumber" className={fieldCls('')} autoComplete="off" placeholder="Certificate of Indian Status #" />
              </div>
              <div>
                <label className="label" htmlFor="bandName">Band / First Nation</label>
                <input id="bandName" name="bandName" className={fieldCls('')} autoComplete="off" placeholder="e.g. band name" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Consent (always) */}
      <section className="card p-6">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Consent</h2>
        <div className="mb-3 max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">{CONSENT_TEXT}</div>
        <label className={`flex items-start gap-2 rounded p-2 text-sm text-gray-700 ${errorNames.has('consent') ? 'bg-red-50 ring-1 ring-red-300' : ''}`}>
          <input type="checkbox" name="consent" value="on" className={`mt-0.5 rounded ${errorNames.has('consent') ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-300'}`} />
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
