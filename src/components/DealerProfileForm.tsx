'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput';
import type { OfficeContact } from '@/lib/dealerProfile';

export interface DealerProfileValues {
  businessName?: string | null;
  address?: string | null;
  shippingAddress?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  billingLabel?: string | null;
  billingContactName?: string | null;
  billingPhone?: string | null;
  billingEmail?: string | null;
  supportLabel?: string | null;
  supportContactName?: string | null;
  supportPhone?: string | null;
  supportEmail?: string | null;
  extraContacts?: OfficeContact[] | null;
  officeHours?: string | null;
  website?: string | null;
}

/** Add/remove additional office people, each with a role + phone + email. */
function ExtraContactsEditor({ initial }: { initial: OfficeContact[] }) {
  const [rows, setRows] = useState<OfficeContact[]>(initial);
  const set = (i: number, patch: Partial<OfficeContact>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const add = () => setRows((r) => [...r, { name: '', role: '', phone: '', email: '' }]);
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <input type="hidden" name="extraContacts" value={JSON.stringify(rows)} />
      {rows.length === 0 && <p className="text-sm text-gray-400">No extra contacts yet.</p>}
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input className="input" value={row.name} placeholder="e.g. Jordan Lee" onChange={(e) => set(i, { name: e.target.value })} />
            </div>
            <div>
              <label className="label">Role / title</label>
              <input className="input" value={row.role} placeholder="e.g. Install manager" onChange={(e) => set(i, { role: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={row.phone} placeholder="(705) 555-0123" onChange={(e) => set(i, { phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={row.email} placeholder="name@office.ca" onChange={(e) => set(i, { email: e.target.value })} />
            </div>
          </div>
          <button type="button" onClick={() => remove(i)} className="mt-2 text-xs font-medium text-red-600 hover:underline">Remove</button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn-secondary text-sm">+ Add a contact</button>
    </div>
  );
}

interface State {
  ok?: boolean;
  error?: string;
  message?: string;
}
type Action = (prev: State, fd: FormData) => Promise<State>;

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  type = 'text',
  textarea = false,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {textarea ? (
        <textarea id={name} name={name} rows={2} defaultValue={defaultValue ?? ''} placeholder={placeholder} className="input" />
      ) : (
        <input id={name} name={name} type={type} defaultValue={defaultValue ?? ''} placeholder={placeholder} className="input" autoComplete="off" />
      )}
    </div>
  );
}

/**
 * Shared office-profile form. Used by a dealer editing their own profile and by
 * an admin editing any office's profile — only the bound `action` differs.
 */
export function DealerProfileForm({
  action,
  values = {},
  logoUrl,
  saveLabel = 'Save profile',
}: {
  action: Action;
  values?: DealerProfileValues;
  logoUrl?: string | null;
  saveLabel?: string;
}) {
  const [state, formAction] = useFormState(action, {} as State);
  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Business</h3>

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Office logo" className="h-full w-full object-contain" />
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14M4 20h12M4 20H3m13 0h5V11a2 2 0 0 0-2-2h-3m-8 2h4m-4 3h4m-4 3h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </div>
          <div className="min-w-0">
            <label className="label" htmlFor="logo">Office logo</label>
            <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
            <p className="mt-1 text-xs text-gray-400">PNG, JPG or WEBP. Shown on your contact card.</p>
            {logoUrl && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" name="removeLogo" className="h-3.5 w-3.5" /> Remove current logo
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="businessName" label="Business name" defaultValue={values.businessName} placeholder="Georgian Water and Air" />
          <Field name="website" label="Website" defaultValue={values.website} placeholder="https://…" />
          <div>
            <label className="label" htmlFor="address">Business address</label>
            <AddressAutocompleteInput id="address" name="address" defaultValue={values.address ?? ''} placeholder="Start typing the address…" className="input" fillFull />
            <p className="mt-1 text-xs text-gray-400">Start typing and pick from the list to auto-fill.</p>
          </div>
          <div>
            <label className="label" htmlFor="shippingAddress">Shipping address</label>
            <AddressAutocompleteInput id="shippingAddress" name="shippingAddress" defaultValue={values.shippingAddress ?? ''} placeholder="If different from above" className="input" fillFull />
          </div>
          <Field name="phone" label="Main phone" defaultValue={values.phone} placeholder="(705) 555-0123" />
          <Field name="altPhone" label="Alternate phone" defaultValue={values.altPhone} placeholder="Toll-free / cell / fax" />
          <Field name="officeHours" label="Office hours" defaultValue={values.officeHours} placeholder="Mon–Fri 9–5, Sat 10–2" textarea />
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-700">First contact</h3>
        <p className="-mt-2 text-xs text-gray-400">Rename the title to whatever fits this office (e.g. Billing, Accounts, Owner).</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field name="billingLabel" label="Section title" defaultValue={values.billingLabel} placeholder="Billing" />
          <Field name="billingContactName" label="Name" defaultValue={values.billingContactName} />
          <Field name="billingPhone" label="Phone" defaultValue={values.billingPhone} />
          <Field name="billingEmail" label="Email" type="email" defaultValue={values.billingEmail} />
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-700">Second contact</h3>
        <p className="-mt-2 text-xs text-gray-400">Rename the title to whatever fits this office (e.g. Customer support, Service, Install).</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field name="supportLabel" label="Section title" defaultValue={values.supportLabel} placeholder="Customer support" />
          <Field name="supportContactName" label="Name" defaultValue={values.supportContactName} />
          <Field name="supportPhone" label="Phone" defaultValue={values.supportPhone} />
          <Field name="supportEmail" label="Email" type="email" defaultValue={values.supportEmail} />
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Other contacts</h3>
          <p className="mt-0.5 text-xs text-gray-400">Add anyone else at the office — each with their own role, phone, and email.</p>
        </div>
        <ExtraContactsEditor initial={values.extraContacts ?? []} />
      </div>

      <div className="flex items-center gap-3">
        <SaveButton label={saveLabel} />
        {state.ok && <span className="text-sm text-green-600">Saved ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
