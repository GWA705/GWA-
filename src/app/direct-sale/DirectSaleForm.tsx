'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createDirectSaleAction, type DirectSaleState } from './actions';
import { PROVINCES, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import type { ProductOption } from '@/lib/products';

interface Office { id: string; name: string }
interface FinanceCo { id: string; name: string }
interface Store { id: string; number: string; name: string | null; dealerId: string }

// Payment methods, in the order they appear on the Direct sale form.
const PAY_METHODS = ['CASH', 'CHEQUE', 'E_TRANSFER', 'CREDIT_CARD', 'HD_CREDIT_CARD', 'FINANCEIT', 'FINANCE_COMPANY'] as const;
// The financed methods — picking one reveals the finance company + deal number.
const FINANCED = new Set(['FINANCEIT', 'FINANCE_COMPANY']);

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save direct sale → In funding'}
    </button>
  );
}

function Err({ errors, field }: { errors?: Record<string, string>; field: string }) {
  const m = errors?.[field];
  return m ? <p className="mt-1 text-xs text-red-600">{m}</p> : null;
}

/**
 * Direct sale entry — one screen that creates the deal AND completes it to
 * Funded + Paid. `offices` is the pickable GWA office list (internal staff);
 * when `fixedOffice` is set the caller is a granted store user locked to their
 * own office (no picker).
 */
export function DirectSaleForm({
  offices,
  fixedOffice,
  defaultDealerId,
  products,
  financeCompanies,
  stores,
}: {
  offices: Office[];
  fixedOffice: Office | null;
  defaultDealerId?: string;
  products: ProductOption[];
  financeCompanies: FinanceCo[];
  stores: Store[];
}) {
  const [state, action] = useFormState(createDirectSaleAction, {} as DirectSaleState);
  const [programType, setProgramType] = useState('GWA');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  // Track the chosen office so the HD store picker lists only that office's
  // stores. A locked grantee has no picker — seed it from the fixed office.
  const [dealerId, setDealerId] = useState(fixedOffice?.id ?? defaultDealerId ?? '');
  const showFinance = FINANCED.has(paymentMethod);
  const showHdRef = programType === 'HD';
  const officeStores = stores.filter((s) => s.dealerId === dealerId);

  return (
    <form action={action} className="card space-y-5 p-5">
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}

      {/* Office */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Office</h2>
        {fixedOffice ? (
          <>
            <input type="hidden" name="dealerId" value={fixedOffice.id} />
            <p className="text-sm text-gray-600 dark:text-slate-300">🏬 {fixedOffice.name}</p>
          </>
        ) : (
          <div className="max-w-sm">
            <label className="label" htmlFor="dealerId">Georgian Water &amp; Air office</label>
            <select id="dealerId" name="dealerId" required value={dealerId} onChange={(e) => setDealerId(e.target.value)} className="input">
              <option value="" disabled>Choose an office…</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <Err errors={state.fieldErrors} field="dealerId" />
          </div>
        )}
      </section>

      {/* Customer */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Customer</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="applicantFirstName">First name</label>
            <input id="applicantFirstName" name="applicantFirstName" required className="input" />
            <Err errors={state.fieldErrors} field="applicantFirstName" />
          </div>
          <div>
            <label className="label" htmlFor="applicantLastName">Last name</label>
            <input id="applicantLastName" name="applicantLastName" required className="input" />
            <Err errors={state.fieldErrors} field="applicantLastName" />
          </div>
          <div>
            <label className="label" htmlFor="applicantEmail">Email</label>
            <input id="applicantEmail" name="applicantEmail" type="email" required className="input" />
            <Err errors={state.fieldErrors} field="applicantEmail" />
          </div>
          <div>
            <label className="label" htmlFor="applicantPhone">Phone</label>
            <input id="applicantPhone" name="applicantPhone" required className="input" placeholder="705-555-0148" />
            <Err errors={state.fieldErrors} field="applicantPhone" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="applicantAddress">Address <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="applicantAddress" name="applicantAddress" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="city">City</label>
            <input id="city" name="city" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="postalCode">Postal</label>
              <input id="postalCode" name="postalCode" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="province">Province</label>
              <select id="province" name="province" defaultValue="ON" className="input">
                {PROVINCES.map((p) => <option key={p.value} value={p.value}>{p.value}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Sale */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Sale</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="programType">Program</label>
            <select id="programType" name="programType" value={programType} onChange={(e) => setProgramType(e.target.value)} className="input">
              <option value="GWA">Georgian Water &amp; Air</option>
              <option value="HD">Home Depot</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="programCategory">Category</label>
            <select id="programCategory" name="programCategory" defaultValue="WATER" className="input">
              <option value="WATER">Water</option>
              <option value="AIR">Air</option>
              <option value="SMELL_BUSTERS">Smell Busters</option>
              <option value="HVAC">HVAC</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="requestedAmount">Sale amount ($)</label>
            <input id="requestedAmount" name="requestedAmount" required inputMode="decimal" className="input" placeholder="5000.00" />
            <Err errors={state.fieldErrors} field="requestedAmount" />
          </div>
          <div>
            <label className="label" htmlFor="dateOfSale">Sale date <span className="font-normal text-gray-400">(= paid date)</span></label>
            <input id="dateOfSale" name="dateOfSale" type="date" required className="input" />
            <Err errors={state.fieldErrors} field="dateOfSale" />
          </div>
          <div>
            <label className="label" htmlFor="installationDate">Install date <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="installationDate" name="installationDate" type="date" className="input" />
          </div>
        </div>

        <div>
          <span className="label">Product(s) sold</span>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
                <input type="checkbox" name="productsSold" value={p.name} className="rounded border-gray-300" />
                {p.name}
              </label>
            ))}
          </div>
          <input name="productsSoldOther" className="input mt-2" placeholder="Other product(s), comma-separated" />
          <p className="mt-1 text-xs text-gray-400">The number of products = the UNITS written to the journal.</p>
          <Err errors={state.fieldErrors} field="productsSold" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="salespersonName">Salesperson <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="salespersonName" name="salespersonName" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="installerName">Installer <span className="font-normal text-gray-400">(optional)</span></label>
            <input id="installerName" name="installerName" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="soapIncluded">SOAP included</label>
            <select id="soapIncluded" name="soapIncluded" defaultValue="" className="input">
              <option value="">—</option>
              <option value="NO">No</option>
              <option value="NV">Yes — NV</option>
              <option value="PS">Yes — PS</option>
              <option value="OTHER">Yes — Other</option>
            </select>
          </div>
        </div>
      </section>

      {/* Payment source */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Payment source</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="paymentMethod">How it was paid</label>
            <select id="paymentMethod" name="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input">
              {PAY_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
            </select>
          </div>
          {showHdRef && (
            <>
              <div>
                <label className="label" htmlFor="hdReference">HD Customer #</label>
                <input id="hdReference" name="hdReference" className="input" placeholder="800255118" />
              </div>
              <div>
                <label className="label" htmlFor="homeDepotStoreId">HD store</label>
                {/* key on dealerId so switching office resets any stale selection */}
                <select
                  key={dealerId}
                  id="homeDepotStoreId"
                  name="homeDepotStoreId"
                  required
                  defaultValue=""
                  disabled={officeStores.length === 0}
                  className="input"
                >
                  <option value="" disabled>{officeStores.length === 0 ? 'No stores for this office' : 'Choose a store…'}</option>
                  {officeStores.map((s) => (
                    <option key={s.id} value={s.id}>{s.number}{s.name ? ` — ${s.name}` : ''}</option>
                  ))}
                </select>
                {officeStores.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">No HD stores assigned to this office — ask an admin to add one.</p>
                )}
                <Err errors={state.fieldErrors} field="homeDepotStoreId" />
              </div>
            </>
          )}
          {showFinance && (
            <>
              <div>
                <label className="label" htmlFor="financeCompanyId">Finance company</label>
                <select id="financeCompanyId" name="financeCompanyId" defaultValue="" className="input">
                  <option value="">—</option>
                  {financeCompanies.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="financeItNumber">Financing deal #</label>
                <input id="financeItNumber" name="financeItNumber" className="input" />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Bill of sale */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Bill of sale</h2>
        <input type="file" name="billOfSaleFile" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" required className="block w-full text-sm" />
        <p className="text-xs text-gray-400">Required. PDF or a photo (JPG, PNG, HEIC), up to 15 MB.</p>
        <Err errors={state.fieldErrors} field="billOfSaleFile" />
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-slate-700">
        <p className="mr-auto text-xs text-gray-500 dark:text-slate-400">Saving records the sale <strong>In funding</strong> and writes the journal row. Mark it funded on the deal; it turns Paid when the journal updates.</p>
        <SubmitBtn />
      </div>
    </form>
  );
}
