'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';
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

type ContactItem = OfficeContact & { _id: number };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '+';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * Add/remove additional office people. Each contact is a collapsible card: the
 * header shows initials + name + role so a long roster stays compact and
 * scannable; tap to expand and edit. New contacts open expanded.
 */
function ExtraContactsEditor({ initial }: { initial: OfficeContact[] }) {
  const t = useT();
  const nextId = useRef(initial.length);
  const [items, setItems] = useState<ContactItem[]>(() => initial.map((c, i) => ({ ...c, _id: i })));
  // Collapse existing (named) contacts by default; keep any nameless ones open.
  const [open, setOpen] = useState<Set<number>>(() => new Set(items.filter((c) => !c.name.trim()).map((c) => c._id)));

  const set = (id: number, patch: Partial<OfficeContact>) =>
    setItems((a) => a.map((row) => (row._id === id ? { ...row, ...patch } : row)));
  const add = () => {
    const id = nextId.current++;
    setItems((a) => [...a, { name: '', role: '', phone: '', email: '', _id: id }]);
    setOpen((o) => new Set(o).add(id));
  };
  const remove = (id: number) => {
    setItems((a) => a.filter((row) => row._id !== id));
    setOpen((o) => {
      const n = new Set(o);
      n.delete(id);
      return n;
    });
  };
  const toggle = (id: number) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-2.5">
      {/* Strip the client-only _id before saving. */}
      <input type="hidden" name="extraContacts" value={JSON.stringify(items.map(({ _id, ...c }) => c))} />
      {items.length === 0 && <p className="text-sm text-gray-400">{t('profile.noExtra')}</p>}
      {items.map((row) => {
        const isOpen = open.has(row._id);
        const summary = row.role.trim() || row.phone.trim() || row.email.trim() || t('profile.tapToAdd');
        return (
          <div key={row._id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => toggle(row._id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {initials(row.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-gray-900">{row.name.trim() || t('profile.newContact')}</span>
                <span className="block truncate text-xs text-gray-500">{summary}</span>
              </span>
              <span className={`flex-none text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden>▾</span>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('profile.name')}</label>
                    <input className="input" value={row.name} placeholder={t('profile.namePlaceholder')} onChange={(e) => set(row._id, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">{t('profile.roleTitle')}</label>
                    <input className="input" value={row.role} placeholder={t('profile.rolePlaceholder')} onChange={(e) => set(row._id, { role: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">{t('profile.phone')}</label>
                    <input className="input" value={row.phone} placeholder="(705) 555-0123" onChange={(e) => set(row._id, { phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">{t('profile.email')}</label>
                    <input className="input" type="email" value={row.email} placeholder="name@office.ca" onChange={(e) => set(row._id, { email: e.target.value })} />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={() => toggle(row._id)} className="text-xs font-medium text-gray-500 hover:underline">{t('profile.done')}</button>
                  <button type="button" onClick={() => remove(row._id)} className="text-xs font-medium text-red-600 hover:underline">{t('profile.remove')}</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" onClick={add} className="btn-secondary text-sm">{t('profile.addContact')}</button>
    </div>
  );
}

interface State {
  ok?: boolean;
  error?: string;
  message?: string;
}
type Action = (prev: State, fd: FormData) => Promise<State>;

function SaveButton({ label, t }: { label: string; t: TFunction }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('profile.saving') : label}
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
  saveLabel,
}: {
  action: Action;
  values?: DealerProfileValues;
  logoUrl?: string | null;
  saveLabel?: string;
}) {
  const t = useT();
  const [state, formAction] = useFormState(action, {} as State);
  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">{t('profile.business')}</h3>

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
            <label className="label" htmlFor="logo">{t('profile.officeLogo')}</label>
            <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
            <p className="mt-1 text-xs text-gray-400">{t('profile.logoHint')}</p>
            {logoUrl && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" name="removeLogo" className="h-3.5 w-3.5" /> {t('profile.removeLogo')}
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="businessName" label={t('profile.businessName')} defaultValue={values.businessName} placeholder="Georgian Water and Air" />
          <Field name="website" label={t('profile.website')} defaultValue={values.website} placeholder="https://…" />
          <div>
            <label className="label" htmlFor="address">{t('profile.businessAddress')}</label>
            <AddressAutocompleteInput id="address" name="address" defaultValue={values.address ?? ''} placeholder={t('profile.addressPlaceholder')} className="input" fillFull />
            <p className="mt-1 text-xs text-gray-400">{t('profile.addressHint')}</p>
          </div>
          <div>
            <label className="label" htmlFor="shippingAddress">{t('profile.shippingAddress')}</label>
            <AddressAutocompleteInput id="shippingAddress" name="shippingAddress" defaultValue={values.shippingAddress ?? ''} placeholder={t('profile.shippingPlaceholder')} className="input" fillFull />
          </div>
          <Field name="phone" label={t('profile.mainPhone')} defaultValue={values.phone} placeholder="(705) 555-0123" />
          <Field name="altPhone" label={t('profile.altPhone')} defaultValue={values.altPhone} placeholder={t('profile.altPhonePlaceholder')} />
          <Field name="officeHours" label={t('profile.officeHours')} defaultValue={values.officeHours} placeholder={t('profile.officeHoursPlaceholder')} textarea />
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-700">{t('profile.firstContact')}</h3>
        <p className="-mt-2 text-xs text-gray-400">{t('profile.firstContactHint')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field name="billingLabel" label={t('profile.sectionTitle')} defaultValue={values.billingLabel} placeholder={t('profile.billingPlaceholder')} />
          <Field name="billingContactName" label={t('profile.name')} defaultValue={values.billingContactName} />
          <Field name="billingPhone" label={t('profile.phone')} defaultValue={values.billingPhone} />
          <Field name="billingEmail" label={t('profile.email')} type="email" defaultValue={values.billingEmail} />
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-700">{t('profile.secondContact')}</h3>
        <p className="-mt-2 text-xs text-gray-400">{t('profile.secondContactHint')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field name="supportLabel" label={t('profile.sectionTitle')} defaultValue={values.supportLabel} placeholder={t('profile.supportPlaceholder')} />
          <Field name="supportContactName" label={t('profile.name')} defaultValue={values.supportContactName} />
          <Field name="supportPhone" label={t('profile.phone')} defaultValue={values.supportPhone} />
          <Field name="supportEmail" label={t('profile.email')} type="email" defaultValue={values.supportEmail} />
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{t('profile.otherContacts')}</h3>
          <p className="mt-0.5 text-xs text-gray-400">{t('profile.otherContactsHint')}</p>
        </div>
        <ExtraContactsEditor initial={values.extraContacts ?? []} />
      </div>

      <div className="flex items-center gap-3">
        <SaveButton label={saveLabel ?? t('profile.saveProfile')} t={t} />
        {state.ok && <span className="text-sm text-green-600">{t('profile.saved')}</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
