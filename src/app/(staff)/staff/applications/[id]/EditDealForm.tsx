'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateDealAction } from '@/app/(staff)/actions';
import { PROVINCES, PROGRAM_TYPES, PROGRAM_CATEGORIES, PHOTO_ID_TYPES } from '@/lib/constants';
import { DateOfBirthInput } from '@/components/DateOfBirthInput';
import { ProductPicker } from '@/components/ProductPicker';

type State = { error?: string; fieldErrors?: Record<string, string> };

export interface EditInitial {
  dealerId: string;
  province: string;
  programType: string;
  programCategory: string;
  requestedAmount: string;
  approvedAmount: string;
  applicantFirstName: string;
  applicantLastName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantDob: string;
  applicantAddress: string;
  govIdNumber: string;
  dateOfSale: string;
  installationDate: string;
  taxExempt: boolean;
  deliveredToReserve: boolean;
  statusCardNumber: string;
  bandName: string;
  financingNote: string;
  notes: string;
  salespersonName: string;
  installerName: string;
  soapIncluded: string; // '' | 'YES' | 'NO'
  productsSold: string[];
  middleName: string;
  homePhone: string;
  maritalStatus: string;
  housingStatus: string;
  monthlyHousingCost: string;
  yearsAtAddress: string;
  city: string;
  addressProvince: string;
  postalCode: string;
  idType: string;
  idProvince: string;
  idExpiry: string;
  businessName: string;
  positionTitle: string;
  employerAddress: string;
  employerPhone: string;
  grossMonthlyIncome: string;
  timeAtJobYears: string;
  employmentStatus: string;
}

function Err({ state, name }: { state: State; name: string }) {
  const msg = state.fieldErrors?.[name];
  return msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}

export function EditDealForm({
  applicationId,
  initial,
  products,
  dealers,
}: {
  applicationId: string;
  initial: EditInitial;
  products: { id: string; name: string; journalName?: string | null; promoted?: boolean }[];
  dealers: { id: string; name: string }[];
}) {
  const [state, action] = useFormState(updateDealAction.bind(null, applicationId), {} as State);
  const v = initial;
  // Preserve any product already on this deal that isn't in the current list
  // (e.g. an archived product) so editing never silently drops it.
  const optionNames = new Set(products.map((p) => p.name.toLowerCase()));
  const extraSelected = v.productsSold.filter((n) => !optionNames.has(n.toLowerCase()));
  const options = [...products, ...extraSelected.map((n) => ({ id: `extra:${n}`, name: n }))];
  const [taxExempt, setTaxExempt] = useState(v.taxExempt);

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {state.error}
        </div>
      )}

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Dealer</h2>
        <p className="mb-3 text-xs text-gray-500">Which dealership this deal belongs to. Change it to reclassify a deal (e.g. one entered under a test dealer) — it then shows in that dealer’s portal instead.</p>
        <div className="max-w-md">
          <label className="label" htmlFor="dealerId">Dealer</label>
          <select id="dealerId" name="dealerId" defaultValue={v.dealerId} className="input">
            {dealers.map((dl) => (<option key={dl.id} value={dl.id}>{dl.name}</option>))}
          </select>
          <Err state={state} name="dealerId" />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Deal details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="programType">Program</label>
            <select id="programType" name="programType" defaultValue={v.programType} className="input">
              {PROGRAM_TYPES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="programType" />
          </div>
          <div>
            <label className="label" htmlFor="programCategory">Category</label>
            <select id="programCategory" name="programCategory" defaultValue={v.programCategory} className="input">
              {PROGRAM_CATEGORIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="programCategory" />
          </div>
          <div>
            <label className="label" htmlFor="province">Province</label>
            <select id="province" name="province" defaultValue={v.province} className="input">
              {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="province" />
          </div>
          <div><label className="label" htmlFor="requestedAmount">Requested amount</label><input id="requestedAmount" name="requestedAmount" type="number" step="0.01" min="0" defaultValue={v.requestedAmount} className="input" /><Err state={state} name="requestedAmount" /></div>
          <div><label className="label" htmlFor="approvedAmount">Approved amount</label><input id="approvedAmount" name="approvedAmount" type="number" step="0.01" min="0" defaultValue={v.approvedAmount} className="input" /></div>
          <div><label className="label" htmlFor="dateOfSale">Date of sale</label><input id="dateOfSale" name="dateOfSale" type="date" defaultValue={v.dateOfSale} className="input" /></div>
          <div><label className="label" htmlFor="installationDate">Installation date</label><input id="installationDate" name="installationDate" type="date" defaultValue={v.installationDate} className="input" /></div>
        </div>
        <div className="mt-4"><label className="label" htmlFor="financingNote">Financing note</label><textarea id="financingNote" name="financingNote" rows={2} defaultValue={v.financingNote} className="input" /></div>
        <div className="mt-4"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={2} defaultValue={v.notes} className="input" /></div>
      </section>

      {/* Sales details — fill the sales journal. */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Sales details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="salespersonName">Salesperson&apos;s name</label><input id="salespersonName" name="salespersonName" defaultValue={v.salespersonName} className="input" /></div>
          <div><label className="label" htmlFor="installerName">Installer&apos;s name</label><input id="installerName" name="installerName" defaultValue={v.installerName} className="input" /></div>
          <div>
            <label className="label" htmlFor="soapIncluded">SOAP included</label>
            <select id="soapIncluded" name="soapIncluded" defaultValue={v.soapIncluded} className="input">
              <option value="">—</option>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <span className="label">Product(s) sold</span>
          <div className="mt-1">
            <ProductPicker products={options} selected={v.productsSold} />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Applicant</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="applicantFirstName">First name</label><input id="applicantFirstName" name="applicantFirstName" defaultValue={v.applicantFirstName} className="input" /><Err state={state} name="applicantFirstName" /></div>
          <div><label className="label" htmlFor="applicantLastName">Last name</label><input id="applicantLastName" name="applicantLastName" defaultValue={v.applicantLastName} className="input" /><Err state={state} name="applicantLastName" /></div>
          <div><label className="label" htmlFor="middleName">Middle name</label><input id="middleName" name="middleName" defaultValue={v.middleName} className="input" /></div>
          <div><label className="label" htmlFor="applicantDob">Date of birth</label><DateOfBirthInput name="applicantDob" id="applicantDob" defaultValue={v.applicantDob} invalid={!!state.fieldErrors?.applicantDob} />{state.fieldErrors?.applicantDob && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.applicantDob}</p>}</div>
          <div><label className="label" htmlFor="applicantEmail">Email</label><input id="applicantEmail" name="applicantEmail" type="email" defaultValue={v.applicantEmail} className="input" /><Err state={state} name="applicantEmail" /></div>
          <div><label className="label" htmlFor="applicantPhone">Mobile phone</label><input id="applicantPhone" name="applicantPhone" defaultValue={v.applicantPhone} className="input" /><Err state={state} name="applicantPhone" /></div>
          <div><label className="label" htmlFor="homePhone">Home phone</label><input id="homePhone" name="homePhone" defaultValue={v.homePhone} className="input" /></div>
          <div>
            <label className="label" htmlFor="maritalStatus">Marital status</label>
            <select id="maritalStatus" name="maritalStatus" defaultValue={v.maritalStatus} className="input">
              <option value="">Select…</option>
              <option>Single</option><option>Married</option><option>Common-law</option>
              <option>Separated</option><option>Divorced</option><option>Widowed</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Address &amp; housing</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="applicantAddress">Street address</label><input id="applicantAddress" name="applicantAddress" defaultValue={v.applicantAddress} className="input" /></div>
          <div><label className="label" htmlFor="city">City</label><input id="city" name="city" defaultValue={v.city} className="input" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="addressProvince">Province</label>
              <select id="addressProvince" name="addressProvince" defaultValue={v.addressProvince} className="input">
                <option value="">Select…</option>
                {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.value}</option>))}
              </select>
            </div>
            <div><label className="label" htmlFor="postalCode">Postal</label><input id="postalCode" name="postalCode" defaultValue={v.postalCode} className="input" maxLength={7} /></div>
          </div>
          <div>
            <label className="label" htmlFor="housingStatus">Housing status</label>
            <select id="housingStatus" name="housingStatus" defaultValue={v.housingStatus} className="input">
              <option value="">Select…</option>
              <option value="OWN">Own</option><option value="RENT">Rent</option><option value="OTHER">Other</option>
            </select>
          </div>
          <div><label className="label" htmlFor="monthlyHousingCost">Monthly housing cost</label><input id="monthlyHousingCost" name="monthlyHousingCost" type="number" step="0.01" min="0" defaultValue={v.monthlyHousingCost} className="input" /></div>
          <div><label className="label" htmlFor="yearsAtAddress">Years at address</label><input id="yearsAtAddress" name="yearsAtAddress" type="number" min="0" defaultValue={v.yearsAtAddress} className="input" /></div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Identification</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="idType">Photo ID type</label>
            <select id="idType" name="idType" defaultValue={v.idType} className="input">
              <option value="">Select…</option>
              {PHOTO_ID_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div><label className="label" htmlFor="govIdNumber">Photo ID number</label><input id="govIdNumber" name="govIdNumber" defaultValue={v.govIdNumber} className="input" autoComplete="off" /></div>
          <div>
            <label className="label" htmlFor="idProvince">Province of issue</label>
            <select id="idProvince" name="idProvince" defaultValue={v.idProvince} className="input">
              <option value="">Select…</option>
              {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
          </div>
          <div><label className="label" htmlFor="idExpiry">Expiry date</label><input id="idExpiry" name="idExpiry" type="date" defaultValue={v.idExpiry} className="input" /></div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Employment &amp; income</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="businessName">Employer / business name</label><input id="businessName" name="businessName" defaultValue={v.businessName} className="input" /></div>
          <div><label className="label" htmlFor="positionTitle">Position title</label><input id="positionTitle" name="positionTitle" defaultValue={v.positionTitle} className="input" /></div>
          <div><label className="label" htmlFor="employerAddress">Employer address</label><input id="employerAddress" name="employerAddress" defaultValue={v.employerAddress} className="input" /></div>
          <div><label className="label" htmlFor="employerPhone">Employer phone</label><input id="employerPhone" name="employerPhone" defaultValue={v.employerPhone} className="input" /></div>
          <div><label className="label" htmlFor="grossMonthlyIncome">Gross monthly income</label><input id="grossMonthlyIncome" name="grossMonthlyIncome" type="number" step="0.01" min="0" defaultValue={v.grossMonthlyIncome} className="input" /></div>
          <div><label className="label" htmlFor="timeAtJobYears">Time at job (years)</label><input id="timeAtJobYears" name="timeAtJobYears" type="number" min="0" defaultValue={v.timeAtJobYears} className="input" /></div>
          <div>
            <label className="label" htmlFor="employmentStatus">Employment status</label>
            <select id="employmentStatus" name="employmentStatus" defaultValue={v.employmentStatus} className="input">
              <option value="">Select…</option>
              <option value="EMPLOYED">Employed</option><option value="SELF_EMPLOYED">Self-employed</option><option value="RETIRED">Retired</option><option value="OTHER">Other</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">First Nations tax exemption</h2>
        <p className="mb-3 text-xs text-gray-500">Capture / confirm the status card and exemption to register with Home Depot before payment.</p>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="taxExempt" value="on" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} className="mt-0.5 rounded border-gray-300" />
          <span>Tax-exempt (valid Certificate of Indian Status)</span>
        </label>
        {taxExempt && (
          <div className="mt-3 space-y-4 border-t border-gray-100 pt-4">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="deliveredToReserve" value="on" defaultChecked={v.deliveredToReserve} className="mt-0.5 rounded border-gray-300" />
              <span>Delivered / installed on a reserve <span className="text-gray-400">(full exemption; otherwise provincial portion only)</span></span>
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="statusCardNumber">Status card number</label><input id="statusCardNumber" name="statusCardNumber" defaultValue={v.statusCardNumber} autoComplete="off" className="input" /></div>
              <div><label className="label" htmlFor="bandName">Band / First Nation</label><input id="bandName" name="bandName" defaultValue={v.bandName} autoComplete="off" className="input" /></div>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link href={`/staff/applications/${applicationId}`} className="btn-secondary">Cancel</Link>
        <SaveButton />
      </div>
    </form>
  );
}
