'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput';

export interface DealerProfileValues {
  businessName?: string | null;
  address?: string | null;
  shippingAddress?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  billingContactName?: string | null;
  billingPhone?: string | null;
  billingEmail?: string | null;
  supportContactName?: string | null;
  supportPhone?: string | null;
  supportEmail?: string | null;
  officeHours?: string | null;
  website?: string | null;
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
  saveLabel = 'Save profile',
}: {
  action: Action;
  values?: DealerProfileValues;
  saveLabel?: string;
}) {
  const [state, formAction] = useFormState(action, {} as State);
  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Business</h3>
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
        <h3 className="text-sm font-semibold text-gray-700">Best contact for billing</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field name="billingContactName" label="Name" defaultValue={values.billingContactName} />
          <Field name="billingPhone" label="Phone" defaultValue={values.billingPhone} />
          <Field name="billingEmail" label="Email" type="email" defaultValue={values.billingEmail} />
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-700">Contact for customer support</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field name="supportContactName" label="Name" defaultValue={values.supportContactName} />
          <Field name="supportPhone" label="Phone" defaultValue={values.supportPhone} />
          <Field name="supportEmail" label="Email" type="email" defaultValue={values.supportEmail} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton label={saveLabel} />
        {state.ok && <span className="text-sm text-green-600">Saved ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
