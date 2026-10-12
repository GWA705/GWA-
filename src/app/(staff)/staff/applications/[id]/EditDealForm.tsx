'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateDealAction } from '@/app/(staff)/actions';
import { PROVINCES, PROGRAM_TYPES, PROGRAM_CATEGORIES, PHOTO_ID_TYPES, SOAP_OPTIONS, PAYMENT_METHODS } from '@/lib/constants';
import { useT } from '@/i18n/client';
import { programTypeLabel, programCategoryLabel, paymentMethodLabel } from '@/lib/enumLabels';
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
  paymentMethod: string;
  financeCompanyId: string;
  financeItNumber: string;
  hdReference: string;
}

function Err({ state, name }: { state: State; name: string }) {
  const msg = state.fieldErrors?.[name];
  return msg ? <p className="mt-1 text-xs text-red-600">{msg}</p> : null;
}

function SaveButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('common.saving') : t('editForm.saveChanges')}
    </button>
  );
}

export function EditDealForm({
  applicationId,
  initial,
  products,
  dealers,
  financeCompanies,
}: {
  applicationId: string;
  initial: EditInitial;
  products: { id: string; name: string; journalName?: string | null; promoted?: boolean }[];
  dealers: { id: string; name: string }[];
  financeCompanies: { id: string; name: string }[];
}) {
  const t = useT();
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
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('editForm.section.dealer')}</h2>
        <p className="mb-3 text-xs text-gray-500">{t('editForm.dealerHint')}</p>
        <div className="max-w-md">
          <label className="label" htmlFor="dealerId">{t('editForm.field.dealer')}</label>
          <select id="dealerId" name="dealerId" defaultValue={v.dealerId} className="input">
            {dealers.map((dl) => (<option key={dl.id} value={dl.id}>{dl.name}</option>))}
          </select>
          <Err state={state} name="dealerId" />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('editForm.section.dealDetails')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="programType">{t('editForm.field.program')}</label>
            <select id="programType" name="programType" defaultValue={v.programType} className="input">
              {PROGRAM_TYPES.map((p) => (<option key={p.value} value={p.value}>{programTypeLabel(t, p.value)}</option>))}
            </select>
            <Err state={state} name="programType" />
          </div>
          <div>
            <label className="label" htmlFor="programCategory">{t('editForm.field.category')}</label>
            <select id="programCategory" name="programCategory" defaultValue={v.programCategory} className="input">
              {PROGRAM_CATEGORIES.map((p) => (<option key={p.value} value={p.value}>{programCategoryLabel(t, p.value)}</option>))}
            </select>
            <Err state={state} name="programCategory" />
          </div>
          <div>
            <label className="label" htmlFor="province">{t('editForm.field.province')}</label>
            <select id="province" name="province" defaultValue={v.province} className="input">
              {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
            <Err state={state} name="province" />
          </div>
          <div><label className="label" htmlFor="requestedAmount">{t('editForm.field.requestedAmount')}</label><input id="requestedAmount" name="requestedAmount" type="number" step="0.01" min="0" defaultValue={v.requestedAmount} className="input" /><Err state={state} name="requestedAmount" /></div>
          <div><label className="label" htmlFor="approvedAmount">{t('editForm.field.approvedAmount')}</label><input id="approvedAmount" name="approvedAmount" type="number" step="0.01" min="0" defaultValue={v.approvedAmount} className="input" /></div>
          <div><label className="label" htmlFor="dateOfSale">{t('editForm.field.dateOfSale')}</label><input id="dateOfSale" name="dateOfSale" type="date" defaultValue={v.dateOfSale} className="input" /></div>
          <div><label className="label" htmlFor="installationDate">{t('editForm.field.installationDate')}</label><input id="installationDate" name="installationDate" type="date" defaultValue={v.installationDate} className="input" /></div>
        </div>
        <div className="mt-4"><label className="label" htmlFor="financingNote">{t('editForm.field.financingNote')}</label><textarea id="financingNote" name="financingNote" rows={2} defaultValue={v.financingNote} className="input" /></div>
        <div className="mt-4"><label className="label" htmlFor="notes">{t('editForm.field.notes')}</label><textarea id="notes" name="notes" rows={2} defaultValue={v.notes} className="input" /></div>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('editForm.section.financing')}</h2>
        <p className="mb-4 text-xs text-gray-500">
          {t('editForm.financingHint')}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="paymentMethod">{t('editForm.field.paymentMethod')}</label>
            <select id="paymentMethod" name="paymentMethod" defaultValue={v.paymentMethod} className="input">
              <option value="">{t('editForm.notSpecified')}</option>
              {PAYMENT_METHODS.map((p) => (<option key={p.value} value={p.value}>{paymentMethodLabel(t, p.value)}</option>))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="financeCompanyId">{t('editForm.field.financeCompany')}</label>
            <select id="financeCompanyId" name="financeCompanyId" defaultValue={v.financeCompanyId} className="input">
              <option value="">{t('editForm.noneDash')}</option>
              {financeCompanies.map((fc) => (<option key={fc.id} value={fc.id}>{fc.name}</option>))}
            </select>
            <Err state={state} name="financeCompanyId" />
          </div>
          <div><label className="label" htmlFor="financeItNumber">{t('editForm.field.loanNumber')}</label><input id="financeItNumber" name="financeItNumber" defaultValue={v.financeItNumber} className="input" /></div>
          <div><label className="label" htmlFor="hdReference">{t('editForm.field.hdCustomerNumber')}</label><input id="hdReference" name="hdReference" defaultValue={v.hdReference} className="input" /></div>
        </div>
      </section>

      {/* Sales details — fill the sales journal. */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('editForm.section.salesDetails')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="salespersonName">{t('editForm.field.salespersonName')}</label><input id="salespersonName" name="salespersonName" defaultValue={v.salespersonName} className="input" /></div>
          <div><label className="label" htmlFor="installerName">{t('editForm.field.installerName')}</label><input id="installerName" name="installerName" defaultValue={v.installerName} className="input" /></div>
          <div>
            <label className="label" htmlFor="soapIncluded">{t('editForm.field.soapIncluded')}</label>
            <select id="soapIncluded" name="soapIncluded" defaultValue={v.soapIncluded} className="input">
              <option value="">{t('editForm.dash')}</option>
              {SOAP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{t(`enum.soap.${o.value}`)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <span className="label">{t('editForm.field.productsSold')}</span>
          <div className="mt-1">
            <ProductPicker products={options} selected={v.productsSold} />
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('editForm.section.applicant')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="applicantFirstName">{t('editForm.field.firstName')}</label><input id="applicantFirstName" name="applicantFirstName" defaultValue={v.applicantFirstName} className="input" /><Err state={state} name="applicantFirstName" /></div>
          <div><label className="label" htmlFor="applicantLastName">{t('editForm.field.lastName')}</label><input id="applicantLastName" name="applicantLastName" defaultValue={v.applicantLastName} className="input" /><Err state={state} name="applicantLastName" /></div>
          <div><label className="label" htmlFor="middleName">{t('editForm.field.middleName')}</label><input id="middleName" name="middleName" defaultValue={v.middleName} className="input" /></div>
          <div><label className="label" htmlFor="applicantDob">{t('editForm.field.dateOfBirth')}</label><DateOfBirthInput name="applicantDob" id="applicantDob" defaultValue={v.applicantDob} invalid={!!state.fieldErrors?.applicantDob} />{state.fieldErrors?.applicantDob && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.applicantDob}</p>}</div>
          <div><label className="label" htmlFor="applicantEmail">{t('editForm.field.email')}</label><input id="applicantEmail" name="applicantEmail" type="email" defaultValue={v.applicantEmail} className="input" /><Err state={state} name="applicantEmail" /></div>
          <div><label className="label" htmlFor="applicantPhone">{t('editForm.field.mobilePhone')}</label><input id="applicantPhone" name="applicantPhone" defaultValue={v.applicantPhone} className="input" /><Err state={state} name="applicantPhone" /></div>
          <div><label className="label" htmlFor="homePhone">{t('editForm.field.homePhone')}</label><input id="homePhone" name="homePhone" defaultValue={v.homePhone} className="input" /></div>
          <div>
            <label className="label" htmlFor="maritalStatus">{t('editForm.field.maritalStatus')}</label>
            <select id="maritalStatus" name="maritalStatus" defaultValue={v.maritalStatus} className="input">
              <option value="">{t('editForm.selectPlaceholder')}</option>
              <option value="Single">{t('editForm.marital.single')}</option><option value="Married">{t('editForm.marital.married')}</option><option value="Common-law">{t('editForm.marital.commonLaw')}</option>
              <option value="Separated">{t('editForm.marital.separated')}</option><option value="Divorced">{t('editForm.marital.divorced')}</option><option value="Widowed">{t('editForm.marital.widowed')}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('editForm.section.addressHousing')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="applicantAddress">{t('editForm.field.streetAddress')}</label><input id="applicantAddress" name="applicantAddress" defaultValue={v.applicantAddress} className="input" /></div>
          <div><label className="label" htmlFor="city">{t('editForm.field.city')}</label><input id="city" name="city" defaultValue={v.city} className="input" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="addressProvince">{t('editForm.field.province')}</label>
              <select id="addressProvince" name="addressProvince" defaultValue={v.addressProvince} className="input">
                <option value="">{t('editForm.selectPlaceholder')}</option>
                {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.value}</option>))}
              </select>
            </div>
            <div><label className="label" htmlFor="postalCode">{t('editForm.field.postal')}</label><input id="postalCode" name="postalCode" defaultValue={v.postalCode} className="input" maxLength={7} /></div>
          </div>
          <div>
            <label className="label" htmlFor="housingStatus">{t('editForm.field.housingStatus')}</label>
            <select id="housingStatus" name="housingStatus" defaultValue={v.housingStatus} className="input">
              <option value="">{t('editForm.selectPlaceholder')}</option>
              <option value="OWN">{t('editForm.housing.own')}</option><option value="RENT">{t('editForm.housing.rent')}</option><option value="OTHER">{t('editForm.housing.other')}</option>
            </select>
          </div>
          <div><label className="label" htmlFor="monthlyHousingCost">{t('editForm.field.monthlyHousingCost')}</label><input id="monthlyHousingCost" name="monthlyHousingCost" type="number" step="0.01" min="0" defaultValue={v.monthlyHousingCost} className="input" /></div>
          <div><label className="label" htmlFor="yearsAtAddress">{t('editForm.field.yearsAtAddress')}</label><input id="yearsAtAddress" name="yearsAtAddress" type="number" min="0" defaultValue={v.yearsAtAddress} className="input" /></div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('editForm.section.identification')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="idType">{t('editForm.field.photoIdType')}</label>
            <select id="idType" name="idType" defaultValue={v.idType} className="input">
              <option value="">{t('editForm.selectPlaceholder')}</option>
              {PHOTO_ID_TYPES.map((idt) => (<option key={idt} value={idt}>{idt}</option>))}
            </select>
          </div>
          <div><label className="label" htmlFor="govIdNumber">{t('editForm.field.photoIdNumber')}</label><input id="govIdNumber" name="govIdNumber" defaultValue={v.govIdNumber} className="input" autoComplete="off" /></div>
          <div>
            <label className="label" htmlFor="idProvince">{t('editForm.field.provinceOfIssue')}</label>
            <select id="idProvince" name="idProvince" defaultValue={v.idProvince} className="input">
              <option value="">{t('editForm.selectPlaceholder')}</option>
              {PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
          </div>
          <div><label className="label" htmlFor="idExpiry">{t('editForm.field.expiryDate')}</label><input id="idExpiry" name="idExpiry" type="date" defaultValue={v.idExpiry} className="input" /></div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{t('editForm.section.employmentIncome')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="businessName">{t('editForm.field.employerBusinessName')}</label><input id="businessName" name="businessName" defaultValue={v.businessName} className="input" /></div>
          <div><label className="label" htmlFor="positionTitle">{t('editForm.field.positionTitle')}</label><input id="positionTitle" name="positionTitle" defaultValue={v.positionTitle} className="input" /></div>
          <div><label className="label" htmlFor="employerAddress">{t('editForm.field.employerAddress')}</label><input id="employerAddress" name="employerAddress" defaultValue={v.employerAddress} className="input" /></div>
          <div><label className="label" htmlFor="employerPhone">{t('editForm.field.employerPhone')}</label><input id="employerPhone" name="employerPhone" defaultValue={v.employerPhone} className="input" /></div>
          <div><label className="label" htmlFor="grossMonthlyIncome">{t('editForm.field.grossMonthlyIncome')}</label><input id="grossMonthlyIncome" name="grossMonthlyIncome" type="number" step="0.01" min="0" defaultValue={v.grossMonthlyIncome} className="input" /></div>
          <div><label className="label" htmlFor="timeAtJobYears">{t('editForm.field.timeAtJob')}</label><input id="timeAtJobYears" name="timeAtJobYears" type="number" min="0" defaultValue={v.timeAtJobYears} className="input" /></div>
          <div>
            <label className="label" htmlFor="employmentStatus">{t('editForm.field.employmentStatus')}</label>
            <select id="employmentStatus" name="employmentStatus" defaultValue={v.employmentStatus} className="input">
              <option value="">{t('editForm.selectPlaceholder')}</option>
              <option value="EMPLOYED">{t('editForm.employment.employed')}</option><option value="SELF_EMPLOYED">{t('editForm.employment.selfEmployed')}</option><option value="RETIRED">{t('editForm.employment.retired')}</option><option value="OTHER">{t('editForm.employment.other')}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('editForm.section.taxExemption')}</h2>
        <p className="mb-3 text-xs text-gray-500">{t('editForm.taxExemptionHint')}</p>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="taxExempt" value="on" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} className="mt-0.5 rounded border-gray-300" />
          <span>{t('editForm.taxExemptLabel')}</span>
        </label>
        {taxExempt && (
          <div className="mt-3 space-y-4 border-t border-gray-100 pt-4">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="deliveredToReserve" value="on" defaultChecked={v.deliveredToReserve} className="mt-0.5 rounded border-gray-300" />
              <span>{t('editForm.deliveredToReserve')} <span className="text-gray-400">{t('editForm.deliveredToReserveHint')}</span></span>
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="statusCardNumber">{t('editForm.field.statusCardNumber')}</label><input id="statusCardNumber" name="statusCardNumber" defaultValue={v.statusCardNumber} autoComplete="off" className="input" /></div>
              <div><label className="label" htmlFor="bandName">{t('editForm.field.bandName')}</label><input id="bandName" name="bandName" defaultValue={v.bandName} autoComplete="off" className="input" /></div>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link href={`/staff/applications/${applicationId}`} className="btn-secondary">{t('common.cancel')}</Link>
        <SaveButton />
      </div>
    </form>
  );
}
