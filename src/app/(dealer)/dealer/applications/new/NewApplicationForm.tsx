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
import { DocScan } from '@/components/DocScan';
import { FinanceitPdfButton } from '@/components/FinanceitPdfButton';
import type { BorrowerAutofill } from '@/lib/autofill';
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput';
import { DateOfBirthInput } from '@/components/DateOfBirthInput';
import { SplitPaymentInput } from '@/components/SplitPaymentInput';
import { ProductPicker } from '@/components/ProductPicker';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';
import { programTypeLabel, programCategoryLabel, paymentMethodLabel } from '@/lib/enumLabels';

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
  const t = useT();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('newApplication.submitting') : t('newApplication.submitApplication')}
    </button>
  );
}

const phoneFmt = (e: React.FormEvent<HTMLInputElement>) => {
  e.currentTarget.value = formatPhone(e.currentTarget.value);
};
const postalFmt = (e: React.FormEvent<HTMLInputElement>) => {
  e.currentTarget.value = formatPostal(e.currentTarget.value);
};

// Field names that have a friendly translated label for the error summary
// (see newApplication.field.* in the dictionaries). Unknown names fall back to
// showing the raw field name.
const FIELD_LABEL_NAMES = new Set<string>([
  'programType', 'programCategory', 'requestedAmount', 'applicantFirstName',
  'applicantLastName', 'applicantEmail', 'applicantPhone', 'applicantAddress',
  'province', 'dateOfSale', 'installationDate', 'homeDepotStoreId', 'consent',
  'paymentMethod', 'financeItNumber', 'salespersonName', 'installerName',
  'soapIncluded', 'productsSold', 'applicantDob', 'coDob', 'employerAddress',
  'employerPhone', 'creditAppFile', 'billOfSaleFile',
]);

// The error-summary label for a field: translated when known, else the raw name.
const fieldLabel = (t: TFunction, name: string): string =>
  FIELD_LABEL_NAMES.has(name) ? t(`newApplication.field.${name}`) : name;

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

// Three ways to process a new customer, ranked by speed and colour-coded. The
// visible text (rank/title/blurb/action) is looked up by `key` from the
// newApplication dictionary; only styling + value live here.
const METHODS: {
  value: Method;
  key: string; // dictionary prefix: express / priority / standard
  icon: string; // emoji shown in the badge
  badge: string; // badge colour
  selected: string; // selected card border + fill
  dot: string; // selected radio indicator fill
  focus: string; // focus ring colour
}[] = [
  {
    value: 'FINANCEIT',
    key: 'express',
    icon: '🚀',
    badge: 'bg-green-100 text-green-800',
    selected: 'border-green-600 bg-green-50 ring-2 ring-green-600/40',
    dot: 'bg-green-600',
    focus: 'focus-visible:ring-green-500',
  },
  {
    value: 'TYPED',
    key: 'priority',
    icon: '⚡',
    badge: 'bg-blue-100 text-blue-800',
    selected: 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/40',
    dot: 'bg-blue-600',
    focus: 'focus-visible:ring-blue-500',
  },
  {
    value: 'PHOTO',
    key: 'standard',
    icon: '📄',
    badge: 'bg-amber-100 text-amber-800',
    selected: 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/40',
    dot: 'bg-amber-500',
    focus: 'focus-visible:ring-amber-500',
  },
];

// Scanned data can be misread, so each section a scan touched must be confirmed
// before submit. Groups map autofill fields → a review checkbox.
const SCAN_SECTIONS: { key: string; label: string; fields: (keyof BorrowerAutofill)[] }[] = [
  { key: 'applicant', label: 'Applicant name & ID', fields: ['firstName', 'middleName', 'lastName', 'dob', 'idType', 'idNumber', 'idProvince', 'idExpiry', 'email', 'phone', 'homePhone', 'maritalStatus'] },
  { key: 'address', label: 'Home address', fields: ['address', 'city', 'province', 'postal', 'monthlyHousingCost', 'yearsAtAddress', 'housingStatus'] },
  { key: 'employment', label: 'Employment & income', fields: ['businessName', 'positionTitle', 'employerAddress', 'employerPhone', 'grossMonthlyIncome', 'timeAtJob'] },
];
// Short labels for the autofill fields, used when the scan flags one as
// possibly misread ("Double-check: Date of birth").
const FIELD_LABELS: Partial<Record<keyof BorrowerAutofill, string>> = {
  firstName: 'First name', middleName: 'Middle name', lastName: 'Last name', dob: 'Date of birth',
  idType: 'ID type', idNumber: 'ID number', idProvince: 'ID province', idExpiry: 'ID expiry',
  email: 'Email', phone: 'Mobile phone', homePhone: 'Home phone', maritalStatus: 'Marital status',
  address: 'Address', city: 'City', province: 'Province', postal: 'Postal code',
  monthlyHousingCost: 'Housing cost', yearsAtAddress: 'Years at address', housingStatus: 'Housing status',
  businessName: 'Employer', positionTitle: 'Position', employerAddress: 'Employer address',
  employerPhone: 'Employer phone', grossMonthlyIncome: 'Gross income', timeAtJob: 'Time at job',
};

// Top-to-bottom order of the scannable sections, so a failed submit scrolls to the
// FIRST unconfirmed one.
const SECTION_ORDER = ['applicant', 'address', 'employment', 'coApplicant'] as const;
export function NewApplicationForm({
  stores,
  products,
}: {
  stores: Store[];
  products: { id: string; name: string; journalName?: string | null; promoted?: boolean }[];
}) {
  const t = useT();
  const [state, action] = useFormState(createApplicationAction, initial);
  // No method chosen yet ('') — the rest of the form stays minimized until the
  // dealer picks option 1/2/3, which then opens the sections that option needs.
  const [method, setMethod] = useState<Method | ''>('');
  const [payment, setPayment] = useState<PaymentMethod>('FINANCEIT');
  const typed = method === 'TYPED';
  const express = method === 'FINANCEIT';
  // The FinanceIT approval number is only needed when the Express deal was
  // financed through FinanceIT.
  const needsFinanceNumber = express && payment === 'FINANCEIT';
  const summaryRef = useRef<HTMLDivElement>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  // Scan verification: which sections a scan filled (need confirming) and which
  // the dealer has confirmed as correct. A scanned deal can't be submitted until
  // every touched section is ticked. showReviewError flags an attempt to submit
  // with sections still unconfirmed.
  const [scanReview, setScanReview] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  // Autofill keys the scan flagged as possibly misread (guessed date order or a
  // low-confidence OCR read), surfaced in the section-confirm banner.
  const [scanUncertain, setScanUncertain] = useState<Set<string>>(new Set());
  const [showReviewError, setShowReviewError] = useState(false);
  const [taxExempt, setTaxExempt] = useState(false);
  const [amount, setAmount] = useState('');
  // Entering a co-applicant first name opens the full co-applicant questionnaire.
  const [coFirstName, setCoFirstName] = useState('');
  const hasCoApplicant = coFirstName.trim().length > 0;
  // Retired applicants have no employer — we only collect their income, so the
  // employer fields are hidden and not required when "Retired" is selected.
  const [employmentStatus, setEmploymentStatus] = useState('');
  const retired = employmentStatus === 'RETIRED';

  // HD lead pre-fill: enter the lead's 701 number, pull the customer's details
  // from the HD Leads Log and drop them into the matching fields.
  const [leadLookup, setLeadLookup] = useState<{ state: 'idle' | 'loading' | 'found' | 'notfound' | 'error'; msg?: string }>({ state: 'idle' });

  // Co-applicant scan: coFirstName is controlled (it opens the section), so set it
  // via state, then apply the rest once the section has rendered.
  const [pendingCo, setPendingCo] = useState<BorrowerAutofill | null>(null);
  useEffect(() => {
    if (!pendingCo || !hasCoApplicant) return;
    const f = pendingCo;
    const set = (id: string, v?: string) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (el && v) el.value = v;
    };
    set('coLastName', f.lastName);
    set('coMiddleName', f.middleName);
    set('coEmail', f.email);
    if (f.phone) set('coPhone', formatPhone(String(f.phone).replace(/\D/g, '').slice(-10)));
    set('coIdType', f.idType || (f.idNumber ? "Driver's Licence" : undefined));
    set('coGovIdNumber', f.idNumber);
    set('coIdProvince', f.idProvince);
    set('coIdExpiry', f.idExpiry);
    set('coAddress', f.address);
    set('coCity', f.city);
    set('coProvince', f.province);
    if (f.postal) set('coPostal', f.postal);
    if (f.dob) window.dispatchEvent(new CustomEvent('gwa:setdate:coDob', { detail: f.dob }));
    setPendingCo(null);
  }, [pendingCo, hasCoApplicant]);

  function fillFromCoLicense(f: BorrowerAutofill) {
    setCoFirstName(f.firstName || f.lastName || ''); // opens the co-applicant section
    setPendingCo(f);
    // Co-applicant details came from a scan → must be confirmed before submit.
    setScanReview((prev) => new Set(prev).add('coApplicant'));
    setConfirmed((prev) => {
      const next = new Set(prev);
      next.delete('coApplicant');
      return next;
    });
  }

  // Flag every section a scan actually populated so it must be verified. Any
  // fresh scan of a section clears a prior confirmation for that section.
  function markScanned(f: BorrowerAutofill) {
    const touched = SCAN_SECTIONS.filter((s) => s.fields.some((k) => {
      const v = f[k];
      return v != null && String(v).trim() !== '';
    })).map((s) => s.key);
    if (touched.length === 0) return;
    setScanReview((prev) => {
      const next = new Set(prev);
      touched.forEach((k) => next.add(k));
      return next;
    });
    setConfirmed((prev) => {
      const next = new Set(prev);
      touched.forEach((k) => next.delete(k));
      return next;
    });
  }

  // Auto-fill the PRIMARY applicant from a scan (licence or uploaded credit app).
  // Sets whatever fields the scan returned; fields not present in the current
  // entry method are simply skipped. The dealer reviews before submitting.
  function fillBorrower(f: BorrowerAutofill, meta?: { uncertain?: string[] }) {
    const set = (id: string, v?: string) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (el && v) el.value = v;
    };
    const phone = (id: string, v?: string) => {
      if (v) set(id, formatPhone(String(v).replace(/\D/g, '').slice(-10)));
    };
    set('applicantFirstName', f.firstName);
    set('middleName', f.middleName);
    set('applicantLastName', f.lastName);
    set('applicantEmail', f.email);
    phone('applicantPhone', f.phone);
    phone('homePhone', f.homePhone);
    set('maritalStatus', f.maritalStatus);
    set('applicantAddress', f.address);
    set('city', f.city);
    set('province', f.province);
    if (f.postal) set('postalCode', f.postal);
    set('monthlyHousingCost', f.monthlyHousingCost);
    set('yearsAtAddress', f.yearsAtAddress);
    set('housingStatus', f.housingStatus);
    set('idType', f.idType || (f.idNumber ? "Driver's Licence" : undefined));
    set('govIdNumber', f.idNumber);
    set('idProvince', f.idProvince);
    set('idExpiry', f.idExpiry);
    set('businessName', f.businessName);
    set('positionTitle', f.positionTitle);
    set('employerAddress', f.employerAddress);
    phone('employerPhone', f.employerPhone);
    set('grossMonthlyIncome', f.grossMonthlyIncome);
    set('timeAtJobYears', f.timeAtJob);
    if (f.dob) window.dispatchEvent(new CustomEvent('gwa:setdate:applicantDob', { detail: f.dob }));
    markScanned(f);
    // Record which fields the scan was unsure about, so the section-confirm
    // banner can point the dealer straight at them.
    setScanUncertain(new Set(meta?.uncertain ?? []));
  }

  async function fillFromLead() {
    const box = document.getElementById('hdReference') as HTMLInputElement | null;
    const booking = box?.value.trim() ?? '';
    if (booking.replace(/\D/g, '').length < 4) {
      setLeadLookup({ state: 'idle' });
      return;
    }
    setLeadLookup({ state: 'loading' });
    try {
      const res = await fetch(`/api/leads/lookup?booking=${encodeURIComponent(booking)}`, { headers: { accept: 'application/json' } });
      const data = await res.json();
      if (!res.ok || !data.found) {
        setLeadLookup({
          state: 'notfound',
          msg: data?.reason === 'not-your-store'
            ? t('newApplication.leadNotYourStore')
            : t('newApplication.leadNotFound'),
        });
        return;
      }
      const L = data.lead;
      const set = (id: string, v?: string) => {
        const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
        if (el && v) el.value = v;
      };
      set('applicantFirstName', L.firstName);
      set('applicantLastName', L.lastName);
      set('applicantEmail', L.email);
      if (L.phone) set('applicantPhone', formatPhone(String(L.phone).replace(/\D/g, '').slice(-10)));
      set('applicantAddress', L.street);
      set('city', L.city);
      set('province', L.province);
      if (L.postal) set('postalCode', L.postal);
      if (L.storeNumber) {
        const store = stores.find((s) => s.number === L.storeNumber);
        if (store) set('homeDepotStoreId', store.id);
      }
      setLeadLookup({
        state: 'found',
        msg: t('newApplication.leadFilledFrom', { name: L.customerName || booking }) + (L.noGood ? t('newApplication.leadNoGoodSuffix') : ''),
      });
    } catch {
      setLeadLookup({ state: 'error', msg: t('newApplication.leadError') });
    }
  }

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
    errorNames.has(name) ? `${base} bg-red-50 ring-2 ring-red-400` : `${base} ${method ? METHOD_RING[method] : ''}`;

  // Fields required for the current entry method. Express requires full deal
  // details (and the FinanceIT number only when paid via FinanceIT).
  const requiredFields: RequiredField[] = [
    ...BASE_REQUIRED,
    ...(express ? FINANCEIT_EXTRA.filter((f) => f.name !== 'homeDepotStoreId' || stores.length > 0) : []),
    ...(needsFinanceNumber ? [{ name: 'financeItNumber', label: 'Financing deal number' }] : []),
    ...(method === 'TYPED'
      ? TYPED_EXTRA.filter((f) => !(retired && (f.name === 'employerAddress' || f.name === 'employerPhone')))
      : []),
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
    // Scan verification: any section a scan filled must be confirmed correct. The
    // confirm checkbox lives IN each section (see renderScanConfirm), so on a miss
    // we scroll to the first unconfirmed section rather than a bottom panel.
    const unconfirmed = SECTION_ORDER.filter((k) => scanReview.has(k) && !confirmed.has(k));

    if (Object.keys(errs).length > 0) {
      e.preventDefault();
      setClientErrors(errs);
      if (unconfirmed.length > 0) setShowReviewError(true);
      summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setClientErrors({});

    if (unconfirmed.length > 0) {
      e.preventDefault();
      setShowReviewError(true);
      const el = document.getElementById(`scan-confirm-${unconfirmed[0]}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setShowReviewError(false);
  }

  // Inline "confirm the scanned info" control, rendered in a section's header only
  // when a scan actually filled that section. Toggling it records the section as
  // confirmed; unconfirmed sections turn amber (and ring) after a failed submit.
  const renderScanConfirm = (sectionKey: string) => {
    if (!scanReview.has(sectionKey)) return null;
    const isOn = confirmed.has(sectionKey);
    const err = showReviewError && !isOn;
    // Fields in this section the scan flagged as possibly misread.
    const flagged = (SCAN_SECTIONS.find((s) => s.key === sectionKey)?.fields ?? [])
      .filter((k) => scanUncertain.has(k))
      .map((k) => FIELD_LABELS[k] ?? String(k));
    return (
      <div className="flex flex-none flex-col items-end gap-1">
        <label
          id={`scan-confirm-${sectionKey}`}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
            isOn
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : err
                ? 'border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-400'
                : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          <input
            type="checkbox"
            checked={isOn}
            onChange={(e) => {
              setConfirmed((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(sectionKey);
                else next.delete(sectionKey);
                return next;
              });
              setShowReviewError(false);
            }}
            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          {isOn ? `✓ ${t('newApplication.verifyScanConfirmedShort')}` : t('newApplication.verifyScanConfirmShort')}
        </label>
        {flagged.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
            ⚠️ {t('newApplication.verifyDoubleCheck')}: {flagged.join(', ')}
          </span>
        )}
      </div>
    );
  };

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
              ? t('newApplication.fixBeforeSubmit')
              : state.error}
          </p>
          {errorEntries.length > 0 && (
            <ul className="mt-2 space-y-1">
              {errorEntries.map(([name, msg]) => {
                const cm = cleanMessage(msg);
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => focusField(name)}
                      className="text-left text-red-700 underline decoration-red-300 underline-offset-2 hover:text-red-900"
                    >
                      {fieldLabel(t, name)} — {cm === 'required' ? t('newApplication.required') : cm}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Entry method */}
      <section className="card p-6">
        <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand-800">
          {t('newApplication.startHere')}
        </span>
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('newApplication.threeChoices')}</h2>
        <p className="mb-4 text-xs text-gray-500">{t('newApplication.tapOption')}</p>
        <div role="radiogroup" aria-label={t('newApplication.methodGroupAria')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  {i + 1} · <span aria-hidden>{m.icon}</span> {t(`newApplication.${m.key}Rank`)}
                </span>
                <div className="text-base font-bold leading-tight text-gray-900">{t(`newApplication.${m.key}Title`)}</div>
                <div className="mt-1 text-xs text-gray-500">{t(`newApplication.${m.key}Blurb`)}</div>
                <span className={`mt-auto pt-3 text-xs font-semibold ${active ? 'text-gray-700' : 'text-brand-600 group-hover:text-brand-700'}`}>
                  {active ? t('newApplication.selected') : `${t(`newApplication.${m.key}Action`)} →`}
                </span>
              </button>
            );
          })}
        </div>
        {method === 'PHOTO' && (
          <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
            {t('newApplication.photoHint')}
          </p>
        )}
        {express && (
          <div className="mt-4 rounded-lg bg-green-50 p-4 ring-1 ring-green-200">
            <p className="label mb-2 text-green-900">{t('newApplication.howDidPay')}</p>
            <div role="radiogroup" aria-label={t('newApplication.paymentTypeAria')} className="flex flex-wrap gap-2">
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
                    {paymentMethodLabel(t, p.value)}
                  </button>
                );
              })}
            </div>
            {errorNames.has('paymentMethod') && (
              <p className="mt-2 text-xs text-red-600">{t('newApplication.selectHowPaid')}</p>
            )}
            <p className="mt-3 text-sm text-green-800">
              {needsFinanceNumber
                ? t('newApplication.financeitBelow')
                : t('newApplication.paidByApproved', { method: paymentMethodLabel(t, payment) })}
            </p>
          </div>
        )}
      </section>

      {/* Nothing chosen yet — keep the rest minimized and prompt for a choice. */}
      {!method && (
        <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-center text-sm text-gray-500">
          Choose option 1, 2, or 3 above to open the fields to complete.
        </p>
      )}

      {/* Everything below opens only once an option (1/2/3) is selected. */}
      {method && (
        <>
      {/* Quick auto-fill — scan a filled credit app to populate the fields this
          option needs. */}
      <section className="card border border-blue-200 bg-blue-50/40 p-5">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-[#0e2756]">Auto-fill this application</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Scan a filled credit app to fill the fields below automatically. Review before submitting.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <DocScan onFields={fillBorrower} />
        </div>
      </section>

      {/* Financing details */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('newApplication.financingDetails')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="programType">{t('newApplication.program')}</label>
            <select id="programType" name="programType" className={fieldCls('programType')}>
              <option value="">{t('newApplication.selectPlaceholder')}</option>
              {PROGRAM_TYPES.map((p) => (<option key={p.value} value={p.value}>{programTypeLabel(t, p.value)}</option>))}
            </select>
            <Err state={state} name="programType" />
          </div>
          <div>
            <label className="label" htmlFor="programCategory">{t('newApplication.category')}</label>
            <select id="programCategory" name="programCategory" className={fieldCls('programCategory')}>
              <option value="">{t('newApplication.selectPlaceholder')}</option>
              {PROGRAM_CATEGORIES.map((p) => (<option key={p.value} value={p.value}>{programCategoryLabel(t, p.value)}</option>))}
            </select>
            <Err state={state} name="programCategory" />
          </div>
          <div>
            <label className="label" htmlFor="requestedAmount">{t('newApplication.requestedAmountCad')}</label>
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
                {t('newApplication.financingDealNumber')}{' '}
                {needsFinanceNumber
                  ? <span className="font-semibold text-green-700">{t('newApplication.enterFinanceitHere')}</span>
                  : <span className="font-normal text-gray-400">{t('newApplication.ifApplicableParen')}</span>}
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
                placeholder={needsFinanceNumber ? t('newApplication.financeitLoanNumber') : t('newApplication.ifApplicable')}
                autoComplete="off"
              />
              {needsFinanceNumber ? (
                <p className="mt-1 text-xs text-green-700">
                  {t('newApplication.financeitHelp', { example: '7779477' })}
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">{t('newApplication.alreadyApprovedHint')}</p>
              )}
              <Err state={state} name="financeItNumber" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="financingNote">{t('newApplication.financingNote')}</label>
            <textarea id="financingNote" name="financingNote" rows={2} className={fieldCls('')} placeholder={t('newApplication.financingNotePlaceholder')} />
          </div>
        </div>

      </section>

      {/* HD lead pre-fill (always available) */}
      <section className="card border border-sky-200 bg-sky-50/40 p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">
          {t('newApplication.hdLeadNumber')} <span className="font-normal text-gray-400">{t('newApplication.optional')}</span>
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          {t('newApplication.hdLeadIntro')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="hdReference"
            name="hdReference"
            placeholder="701XXXXXXX"
            inputMode="numeric"
            autoComplete="off"
            className="input max-w-xs"
            onBlur={fillFromLead}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                fillFromLead();
              }
            }}
          />
          <button
            type="button"
            onClick={fillFromLead}
            disabled={leadLookup.state === 'loading'}
            className="btn-secondary text-sm disabled:opacity-60"
          >
            {leadLookup.state === 'loading' ? t('newApplication.looking') : t('newApplication.findAndFill')}
          </button>
        </div>
        {leadLookup.state === 'found' && (
          <p className="mt-2 text-xs font-medium text-green-700">✓ {leadLookup.msg}</p>
        )}
        {(leadLookup.state === 'notfound' || leadLookup.state === 'error') && (
          <p className="mt-2 text-xs text-amber-700">{leadLookup.msg}</p>
        )}
      </section>

      {/* Deal details */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('newApplication.dealDetails')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="dateOfSale">{t('newApplication.dateOfSale')}</label><input id="dateOfSale" name="dateOfSale" type="date" className={fieldCls('dateOfSale')} /><Err state={state} name="dateOfSale" /></div>
          <div><label className="label" htmlFor="installationDate">{t('newApplication.installationDate')}</label><input id="installationDate" name="installationDate" type="date" className={fieldCls('installationDate')} /><Err state={state} name="installationDate" /></div>
          <div>
            <label className="label" htmlFor="homeDepotStoreId">{t('newApplication.homeDepotStore')}</label>
            <select id="homeDepotStoreId" name="homeDepotStoreId" className={fieldCls('homeDepotStoreId')} disabled={stores.length === 0}>
              <option value="">{stores.length === 0 ? t('newApplication.noStoresAssigned') : t('newApplication.selectPlaceholder')}</option>
              {stores.map((s) => (<option key={s.id} value={s.id}>{s.number}{s.name ? ` — ${s.name}` : ''}</option>))}
            </select>
            {stores.length === 0 && <p className="mt-1 text-xs text-gray-400">{t('newApplication.askAdminStores')}</p>}
          </div>
        </div>
      </section>

      {/* Sales details — flow into the sales journal. Optional. */}
      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('newApplication.salesDetails')}</h2>
        <p className="mb-4 text-xs text-gray-500">{t('newApplication.salesDetailsHint')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="salespersonName">{t('newApplication.salespersonName')}</label><input id="salespersonName" name="salespersonName" className={fieldCls('')} /></div>
          <div><label className="label" htmlFor="installerName">{t('newApplication.installerName')}</label><input id="installerName" name="installerName" className={fieldCls('')} /></div>
          <div>
            <label className="label" htmlFor="soapIncluded">{t('newApplication.soapIncluded')}</label>
            <select id="soapIncluded" name="soapIncluded" className={fieldCls('')}>
              <option value="">—</option>
              {SOAP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{t(`enum.soap.${o.value}`)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <span className="label">{t('newApplication.productsSold')}</span>
          <div className="mt-1">
            {/* Searchable chip picker. Anything typed under "Other" on more than
                two deals is promoted onto this dealer's list automatically. */}
            <ProductPicker products={products} allowAddToList />
          </div>
        </div>
      </section>

      {/* Applicant (always) */}
      <section className="card p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">{t('newApplication.applicant')}</h2>
          {renderScanConfirm('applicant')}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="applicantFirstName">{t('newApplication.firstName')}</label><input id="applicantFirstName" name="applicantFirstName" className={fieldCls('applicantFirstName')} /><Err state={state} name="applicantFirstName" /></div>
          <div><label className="label" htmlFor="applicantLastName">{t('newApplication.lastName')}</label><input id="applicantLastName" name="applicantLastName" className={fieldCls('applicantLastName')} /><Err state={state} name="applicantLastName" /></div>
          {typed && <div><label className="label" htmlFor="middleName">{t('newApplication.middleName')} <span className="font-normal text-gray-400">{t('newApplication.optional')}</span></label><input id="middleName" name="middleName" className={fieldCls('')} /></div>}
          {/* Express deals are already approved, so no date of birth is needed. */}
          {!express && <div><label className="label" htmlFor="applicantDob">{t('newApplication.dateOfBirth')}</label><DateOfBirthInput name="applicantDob" id="applicantDob" invalid={errorNames.has('applicantDob')} /><Err state={state} name="applicantDob" /></div>}
          <div><label className="label" htmlFor="applicantEmail">{t('newApplication.email')}</label><input id="applicantEmail" name="applicantEmail" type="email" className={fieldCls('applicantEmail')} /><Err state={state} name="applicantEmail" /></div>
          <div><label className="label" htmlFor="applicantPhone">{t('newApplication.mobilePhone')}</label><input id="applicantPhone" name="applicantPhone" className={fieldCls('applicantPhone')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /><Err state={state} name="applicantPhone" /></div>
          {typed && <div><label className="label" htmlFor="homePhone">{t('newApplication.homePhone')} <span className="font-normal text-gray-400">{t('newApplication.optional')}</span></label><input id="homePhone" name="homePhone" className={fieldCls('')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /></div>}
          {typed && (
            <div>
              <label className="label" htmlFor="maritalStatus">{t('newApplication.maritalStatus')}</label>
              <select id="maritalStatus" name="maritalStatus" className={fieldCls('')}>
                <option value="">{t('newApplication.selectPlaceholder')}</option>
                <option value="Single">{t('newApplication.single')}</option><option value="Married">{t('newApplication.married')}</option><option value="Common-law">{t('newApplication.commonLaw')}</option>
                <option value="Separated">{t('newApplication.separated')}</option><option value="Divorced">{t('newApplication.divorced')}</option><option value="Widowed">{t('newApplication.widowed')}</option>
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Address (always) */}
      <section className="card p-6">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">{t('newApplication.address')}</h2>
          {renderScanConfirm('address')}
        </div>
        <p className="mb-4 text-xs text-gray-400">{t('newApplication.addressHint')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="applicantAddress">{t('newApplication.streetAddress')}</label>
            <AddressAutocompleteInput id="applicantAddress" name="applicantAddress" className={fieldCls('applicantAddress')} cityId="city" provinceId="province" postalId="postalCode" />
            <Err state={state} name="applicantAddress" />
          </div>
          <div><label className="label" htmlFor="city">{t('newApplication.city')}</label><input id="city" name="city" className={fieldCls('')} /></div>
          <div>
            <label className="label" htmlFor="province">{t('newApplication.province')}</label>
            <select id="province" name="province" className={fieldCls('province')}>
              <option value="">{t('newApplication.selectPlaceholder')}</option>
              {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="province" />
          </div>
          <div><label className="label" htmlFor="postalCode">{t('newApplication.postalCode')}</label><input id="postalCode" name="postalCode" className={fieldCls('')} placeholder="L0L 2T0" maxLength={7} onInput={postalFmt} /></div>
        </div>

        {typed && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="housingStatus">{t('newApplication.housingStatus')}</label>
                <select id="housingStatus" name="housingStatus" className={fieldCls('')}>
                  <option value="">{t('newApplication.selectPlaceholder')}</option>
                  <option value="OWN">{t('newApplication.own')}</option><option value="RENT">{t('newApplication.rent')}</option><option value="OTHER">{t('newApplication.other')}</option>
                </select>
              </div>
              <div><label className="label" htmlFor="monthlyHousingCost">{t('newApplication.monthlyHousingCost')}</label><input id="monthlyHousingCost" name="monthlyHousingCost" type="number" step="0.01" min="0" className={fieldCls('')} /></div>
              <div><label className="label" htmlFor="yearsAtAddress">{t('newApplication.yearsAtAddress')}</label><input id="yearsAtAddress" name="yearsAtAddress" type="number" min="0" className={fieldCls('')} /></div>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">{t('newApplication.additionalAddresses')}</summary>
              <div className="mt-3 space-y-4">
                {[
                  { key: 'mailing', label: t('newApplication.mailingAddress') },
                  { key: 'previous', label: t('newApplication.previousAddress') },
                  { key: 'worksite', label: t('newApplication.worksiteAddress') },
                ].map((a) => (
                  <div key={a.key} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2"><label className="label">{a.label}</label><input name={`${a.key}Address`} className={fieldCls('')} /></div>
                    <div><label className="label">{t('newApplication.city')}</label><input name={`${a.key}City`} className={fieldCls('')} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label">{t('newApplication.provAbbr')}</label><input name={`${a.key}Province`} className={fieldCls('')} /></div>
                      <div><label className="label">{t('newApplication.postalAbbr')}</label><input name={`${a.key}Postal`} className={fieldCls('')} maxLength={7} onInput={postalFmt} /></div>
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
            <h2 className="mb-4 text-base font-semibold text-gray-900">{t('newApplication.borrowerId')}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="idType">{t('newApplication.photoIdType')}</label>
                <select id="idType" name="idType" className={fieldCls('')}>
                  <option value="">{t('newApplication.selectPlaceholder')}</option>
                  {PHOTO_ID_TYPES.map((idt) => (
                    <option key={idt} value={idt}>{idt}</option>
                  ))}
                </select>
              </div>
              <div><label className="label" htmlFor="govIdNumber">{t('newApplication.photoIdNumber')}</label><input id="govIdNumber" name="govIdNumber" className={fieldCls('')} autoComplete="off" /></div>
              <div>
                <label className="label" htmlFor="idProvince">{t('newApplication.provinceOfIssue')}</label>
                <select id="idProvince" name="idProvince" className={fieldCls('')}>
                  <option value="">{t('newApplication.selectPlaceholder')}</option>
                  {PROVINCES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div><label className="label" htmlFor="idExpiry">{t('newApplication.expiryDate')}</label><input id="idExpiry" name="idExpiry" type="date" className={fieldCls('')} /></div>
            </div>
          </section>

          {/* Employment & income */}
          <section className="card p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">{t('newApplication.employmentIncome')}</h2>
              {renderScanConfirm('employment')}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Status first — a "Retired" choice hides the employer fields below. */}
              <div>
                <label className="label" htmlFor="employmentStatus">{t('newApplication.employmentStatus')}</label>
                <select
                  id="employmentStatus"
                  name="employmentStatus"
                  className={fieldCls('')}
                  value={employmentStatus}
                  onChange={(e) => setEmploymentStatus(e.target.value)}
                >
                  <option value="">{t('newApplication.selectPlaceholder')}</option>
                  <option value="EMPLOYED">{t('newApplication.employed')}</option><option value="SELF_EMPLOYED">{t('newApplication.selfEmployed')}</option><option value="RETIRED">{t('newApplication.retired')}</option><option value="OTHER">{t('newApplication.other')}</option>
                </select>
              </div>
              {retired ? (
                <div>
                  <label className="label" htmlFor="grossMonthlyIncome">
                    {t('newApplication.grossMonthlyIncome')} <span className="font-normal text-gray-400">{t('newApplication.pensionHint')}</span>
                  </label>
                  <input id="grossMonthlyIncome" name="grossMonthlyIncome" type="number" step="0.01" min="0" className={fieldCls('')} />
                </div>
              ) : (
                <>
                  <div><label className="label" htmlFor="businessName">{t('newApplication.employerBusinessName')}</label><input id="businessName" name="businessName" className={fieldCls('')} /></div>
                  <div><label className="label" htmlFor="positionTitle">{t('newApplication.positionTitle')}</label><input id="positionTitle" name="positionTitle" className={fieldCls('')} /></div>
                  <div><label className="label" htmlFor="employerAddress">{t('newApplication.employerAddress')}</label><AddressAutocompleteInput id="employerAddress" name="employerAddress" className={fieldCls('employerAddress')} placeholder={t('newApplication.startTypingAddress')} /><Err state={state} name="employerAddress" /></div>
                  <div><label className="label" htmlFor="employerPhone">{t('newApplication.employerPhone')}</label><input id="employerPhone" name="employerPhone" className={fieldCls('employerPhone')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /><Err state={state} name="employerPhone" /></div>
                  <div><label className="label" htmlFor="grossMonthlyIncome">{t('newApplication.grossMonthlyIncome')}</label><input id="grossMonthlyIncome" name="grossMonthlyIncome" type="number" step="0.01" min="0" className={fieldCls('')} /></div>
                  <div><label className="label" htmlFor="timeAtJobYears">{t('newApplication.timeAtJob')}</label><input id="timeAtJobYears" name="timeAtJobYears" type="number" min="0" className={fieldCls('')} /></div>
                </>
              )}
            </div>
            {retired && (
              <p className="mt-3 text-xs text-gray-500">
                {t('newApplication.retiredNote')}
              </p>
            )}
          </section>

          {/* Co-applicant */}
          <section className="card p-6">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">{t('newApplication.coApplicant')}</h2>
              {renderScanConfirm('coApplicant')}
            </div>
            <p className="mb-3 text-xs text-gray-400">
              {t('newApplication.coApplicantHint')}
            </p>
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <DocScan onFields={fillFromCoLicense} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="coFirstName">{t('newApplication.coFirstName')}</label>
                <input
                  id="coFirstName"
                  name="coFirstName"
                  className={fieldCls('')}
                  value={coFirstName}
                  onChange={(e) => setCoFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="coLastName">{t('newApplication.coLastName')}</label>
                <input id="coLastName" name="coLastName" className={fieldCls('')} />
              </div>
            </div>

            {hasCoApplicant && (
              <div className="mt-5 space-y-5 border-t border-gray-100 pt-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><label className="label" htmlFor="coMiddleName">{t('newApplication.middleName')} <span className="font-normal text-gray-400">{t('newApplication.optional')}</span></label><input id="coMiddleName" name="coMiddleName" className={fieldCls('')} /></div>
                  <div><label className="label" htmlFor="coRelationship">{t('newApplication.relationship')}</label><input id="coRelationship" name="coRelationship" className={fieldCls('')} placeholder={t('newApplication.relationshipPlaceholder')} /></div>
                  <div><label className="label" htmlFor="coDob">{t('newApplication.dateOfBirth')}</label><DateOfBirthInput name="coDob" id="coDob" invalid={errorNames.has('coDob')} /><Err state={state} name="coDob" /></div>
                  <div>
                    <label className="label" htmlFor="coMaritalStatus">{t('newApplication.maritalStatus')}</label>
                    <select id="coMaritalStatus" name="coMaritalStatus" className={fieldCls('')}>
                      <option value="">{t('newApplication.selectPlaceholder')}</option>
                      <option value="Single">{t('newApplication.single')}</option><option value="Married">{t('newApplication.married')}</option><option value="Common-law">{t('newApplication.commonLaw')}</option>
                      <option value="Separated">{t('newApplication.separated')}</option><option value="Divorced">{t('newApplication.divorced')}</option><option value="Widowed">{t('newApplication.widowed')}</option>
                    </select>
                  </div>
                  <div><label className="label" htmlFor="coEmail">{t('newApplication.email')}</label><input id="coEmail" name="coEmail" type="email" className={fieldCls('')} /></div>
                  <div><label className="label" htmlFor="coPhone">{t('newApplication.mobilePhone')}</label><input id="coPhone" name="coPhone" className={fieldCls('')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /></div>
                  <div><label className="label" htmlFor="coHomePhone">{t('newApplication.homePhone')} <span className="font-normal text-gray-400">{t('newApplication.optional')}</span></label><input id="coHomePhone" name="coHomePhone" className={fieldCls('')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /></div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('newApplication.coAddress')}</h3>
                  <p className="mb-3 text-xs text-gray-400">{t('newApplication.coAddressHint')}</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="label" htmlFor="coAddress">{t('newApplication.streetAddress')}</label>
                      <AddressAutocompleteInput id="coAddress" name="coAddress" className={fieldCls('')} cityId="coCity" provinceId="coProvince" postalId="coPostal" />
                    </div>
                    <div><label className="label" htmlFor="coCity">{t('newApplication.city')}</label><input id="coCity" name="coCity" className={fieldCls('')} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label" htmlFor="coProvince">{t('newApplication.province')}</label>
                        <select id="coProvince" name="coProvince" className={fieldCls('')}>
                          <option value="">{t('newApplication.selectPlaceholder')}</option>
                          {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.value}</option>))}
                        </select>
                      </div>
                      <div><label className="label" htmlFor="coPostal">{t('newApplication.postalAbbr')}</label><input id="coPostal" name="coPostal" className={fieldCls('')} maxLength={7} onInput={postalFmt} /></div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('newApplication.coId')}</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="coIdType">{t('newApplication.photoIdType')}</label>
                      <select id="coIdType" name="coIdType" className={fieldCls('')}>
                        <option value="">{t('newApplication.selectPlaceholder')}</option>
                        {PHOTO_ID_TYPES.map((idt) => (<option key={idt} value={idt}>{idt}</option>))}
                      </select>
                    </div>
                    <div><label className="label" htmlFor="coGovIdNumber">{t('newApplication.photoIdNumber')}</label><input id="coGovIdNumber" name="coGovIdNumber" className={fieldCls('')} autoComplete="off" /></div>
                    <div>
                      <label className="label" htmlFor="coIdProvince">{t('newApplication.provinceOfIssue')}</label>
                      <select id="coIdProvince" name="coIdProvince" className={fieldCls('')}>
                        <option value="">{t('newApplication.selectPlaceholder')}</option>
                        {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                      </select>
                    </div>
                    <div><label className="label" htmlFor="coIdExpiry">{t('newApplication.expiryDate')}</label><input id="coIdExpiry" name="coIdExpiry" type="date" className={fieldCls('')} /></div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('newApplication.coEmployment')}</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><label className="label" htmlFor="coBusinessName">{t('newApplication.employerBusinessName')}</label><input id="coBusinessName" name="coBusinessName" className={fieldCls('')} /></div>
                    <div><label className="label" htmlFor="coPositionTitle">{t('newApplication.positionTitle')}</label><input id="coPositionTitle" name="coPositionTitle" className={fieldCls('')} /></div>
                    <div><label className="label" htmlFor="coEmployerAddress">{t('newApplication.employerAddress')} <span className="font-normal text-gray-400">{t('newApplication.optional')}</span></label><input id="coEmployerAddress" name="coEmployerAddress" className={fieldCls('')} /></div>
                    <div><label className="label" htmlFor="coEmployerPhone">{t('newApplication.employerPhone')} <span className="font-normal text-gray-400">{t('newApplication.optional')}</span></label><input id="coEmployerPhone" name="coEmployerPhone" className={fieldCls('')} inputMode="numeric" maxLength={12} placeholder="705-812-0320" onInput={phoneFmt} /></div>
                    <div><label className="label" htmlFor="coGrossMonthlyIncome">{t('newApplication.grossMonthlyIncome')}</label><input id="coGrossMonthlyIncome" name="coGrossMonthlyIncome" type="number" step="0.01" min="0" className={fieldCls('')} /></div>
                    <div><label className="label" htmlFor="coTimeAtJobYears">{t('newApplication.timeAtJob')}</label><input id="coTimeAtJobYears" name="coTimeAtJobYears" type="number" min="0" className={fieldCls('')} /></div>
                    <div>
                      <label className="label" htmlFor="coEmploymentStatus">{t('newApplication.employmentStatus')}</label>
                      <select id="coEmploymentStatus" name="coEmploymentStatus" className={fieldCls('')}>
                        <option value="">{t('newApplication.selectPlaceholder')}</option>
                        <option value="EMPLOYED">{t('newApplication.employed')}</option><option value="SELF_EMPLOYED">{t('newApplication.selfEmployed')}</option><option value="RETIRED">{t('newApplication.retired')}</option><option value="OTHER">{t('newApplication.other')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Notes */}
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">{t('newApplication.notes')}</h2>
            <div><label className="label" htmlFor="notes">{t('newApplication.notes')} <span className="font-normal text-gray-400">{t('newApplication.optional')}</span></label><textarea id="notes" name="notes" rows={3} className={fieldCls('')} /></div>
          </section>
        </>
      )}

      {/* First Nations tax exemption (always available) */}
      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('newApplication.taxExemptionTitle')}</h2>
        <p className="mb-3 text-xs text-gray-500">{t('newApplication.taxExemptionHint')}</p>
        <label className="flex items-start gap-2 rounded p-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="taxExempt"
            value="on"
            checked={taxExempt}
            onChange={(e) => setTaxExempt(e.target.checked)}
            className="mt-0.5 rounded border-gray-300"
          />
          <span>{t('newApplication.taxExemptCheckbox')}</span>
        </label>
        {taxExempt && (
          <div className="mt-3 space-y-4 border-t border-gray-100 pt-4">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="deliveredToReserve" value="on" className="mt-0.5 rounded border-gray-300" />
              <span>{t('newApplication.deliveredToReserve')} <span className="text-gray-400">{t('newApplication.deliveredToReserveHint')}</span></span>
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="statusCardNumber">{t('newApplication.statusCardNumber')} <span className="font-normal text-gray-400">{t('newApplication.statusCardLater')}</span></label>
                <input id="statusCardNumber" name="statusCardNumber" className={fieldCls('')} autoComplete="off" placeholder={t('newApplication.statusCardPlaceholder')} />
              </div>
              <div>
                <label className="label" htmlFor="bandName">{t('newApplication.bandName')}</label>
                <input id="bandName" name="bandName" className={fieldCls('')} autoComplete="off" placeholder={t('newApplication.bandPlaceholder')} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Standard (option 3): attach the credit app and bill of sale right here
          so there's no confusion or separate step. Both optional at submit — they
          can also be added later on the application page. The server stores them
          after the application is created (see createApplicationAction). */}
      {method === 'PHOTO' && (
        <section className="card border border-blue-200 bg-blue-50/40 p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-[#0e2756]">{t('newApplication.uploadsTitle')}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{t('newApplication.uploadsHint')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="creditAppFile">{t('newApplication.uploadCreditApp')}</label>
              <input
                id="creditAppFile"
                name="creditAppFile"
                type="file"
                accept=".pdf,image/*"
                className="block w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
              />
              <Err state={state} name="creditAppFile" />
            </div>
            <div>
              <label className="label" htmlFor="billOfSaleFile">{t('newApplication.uploadBillOfSale')}</label>
              <input
                id="billOfSaleFile"
                name="billOfSaleFile"
                type="file"
                accept=".pdf,image/*"
                className="block w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
              />
              <Err state={state} name="billOfSaleFile" />
            </div>
          </div>
        </section>
      )}

      {/* Consent (always) — the notice text itself is a legal notice reproduced
          verbatim (see CONSENT_TEXT); only the surrounding UI is translated. */}
      <section className="card p-6">
        <h2 className="mb-2 text-base font-semibold text-gray-900">{t('newApplication.consent')}</h2>
        <div className="mb-3 max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">{CONSENT_TEXT}</div>
        <label className={`flex items-start gap-2 rounded p-2 text-sm text-gray-700 ${errorNames.has('consent') ? 'bg-red-50 ring-1 ring-red-300' : ''}`}>
          <input type="checkbox" name="consent" value="on" className={`mt-0.5 rounded ${errorNames.has('consent') ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-300'}`} />
          <span>{t('newApplication.consentCheckbox')}</span>
        </label>
        <Err state={state} name="consent" />
      </section>

      {showReviewError && SECTION_ORDER.some((k) => scanReview.has(k) && !confirmed.has(k)) && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {t('newApplication.verifyScanRequired')}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {typed && <FinanceitPdfButton className="mr-auto" />}
        <SubmitButton />
      </div>
        </>
      )}
    </form>
  );
}
