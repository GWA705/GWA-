'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitOnboardRequestAction, type OnboardState } from './actions';
import { useT } from '@/i18n/client';

interface Row {
  id: number;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  isMainContact: boolean;
}
const blank = (id: number): Row => ({ id, name: '', email: '', phone: '', jobTitle: '', isMainContact: false });

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary" disabled={pending || disabled}>
      {pending ? t('onboard.sending') : t('onboard.sendRequest')}
    </button>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} placeholder={placeholder} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function OnboardForm() {
  const t = useT();
  const [state, action] = useFormState(submitOnboardRequestAction, {} as OnboardState);
  const [rows, setRows] = useState<Row[]>([blank(1)]);
  const [nextId, setNextId] = useState(2);

  // Main contact
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Office
  const [company, setCompany] = useState('');
  const [legalName, setLegalName] = useState('');
  const [officePhone, setOfficePhone] = useState('');
  const [officeEmail, setOfficeEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postal, setPostal] = useState('');
  const [mailingAddress, setMailingAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [note, setNote] = useState('');

  function update(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, blank(nextId)]);
    setNextId((n) => n + 1);
  }
  function removeRow(id: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  const payload = JSON.stringify({
    contactName, email, phone,
    company, legalName, officePhone, officeEmail, address, city, province, postal, mailingAddress, website, note,
    people: rows.map(({ name, email: e, phone: p, jobTitle, isMainContact }) => ({ name, email: e, phone: p, jobTitle, isMainContact })),
  });

  // The office section reveals once the main contact is named.
  const showOffice = contactName.trim().length > 0;
  const ready =
    contactName.trim() && email.trim() && company.trim() && address.trim() && city.trim() &&
    province.trim() && postal.trim() && rows.some((r) => r.name.trim() && r.email.trim());

  if (state.ok) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-6 text-center">
        <h2 className="text-base font-semibold text-green-800">{t('onboard.sentTitle')}</h2>
        <p className="mt-1 text-sm text-green-700">
          {t('onboard.sentBody')}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-5 p-6">
      <input type="hidden" name="payload" value={payload} />

      <div>
        <label className="label" htmlFor="accessCode">{t('onboard.accessCode')}</label>
        <input id="accessCode" name="accessCode" required className="input sm:max-w-xs" placeholder={t('onboard.accessCodePlaceholder')} autoComplete="off" />
        <p className="mt-1 text-xs text-gray-400">{t('onboard.accessCodeHint')}</p>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">{t('onboard.mainContact')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('onboard.fullName')} value={contactName} onChange={setContactName} placeholder="Jane Doe" />
          <Field label={t('onboard.email')} value={email} onChange={setEmail} type="email" placeholder="jane@office.ca" />
          <Field label={t('onboard.phone')} value={phone} onChange={setPhone} placeholder="(705) 555-0123" />
        </div>
      </div>

      {showOffice && (
        <div className="border-t border-gray-100 pt-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-800">{t('onboard.officeDetails')}</h2>
          <p className="mb-3 text-xs text-gray-400">{t('onboard.officeDetailsHint')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('onboard.operatingName')} value={company} onChange={setCompany} placeholder="Barrie Water Co." />
            <Field label={t('onboard.legalName')} value={legalName} onChange={setLegalName} placeholder="1234567 Ontario Inc." hint={t('onboard.legalNameHint')} />
            <Field label={t('onboard.officePhone')} value={officePhone} onChange={setOfficePhone} placeholder="(705) 555-0100" />
            <Field label={t('onboard.officeEmail')} value={officeEmail} onChange={setOfficeEmail} type="email" placeholder="office@company.ca" />
            <Field label={t('onboard.website')} value={website} onChange={setWebsite} placeholder="www.company.ca" hint={t('onboard.websiteHint')} />
          </div>
          <div className="mt-3">
            <Field label={t('onboard.streetAddress')} value={address} onChange={setAddress} placeholder="123 Main St, Unit 4" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t('onboard.cityTown')} value={city} onChange={setCity} placeholder="Barrie" />
            <Field label={t('onboard.province')} value={province} onChange={setProvince} placeholder="ON" />
            <Field label={t('onboard.postalCode')} value={postal} onChange={setPostal} placeholder="L4M 1A1" />
          </div>
          <div className="mt-3">
            <label className="label">{t('onboard.mailingAddress')} <span className="font-normal text-gray-400">{t('onboard.mailingAddressOptional')}</span></label>
            <textarea className="input" rows={2} value={mailingAddress} maxLength={300} onChange={(e) => setMailingAddress(e.target.value)} placeholder={t('onboard.mailingPlaceholder')} />
          </div>
          <div className="mt-3">
            <label className="label">{t('onboard.companyLogo')} <span className="font-normal text-gray-400">{t('onboard.companyLogoOptional')}</span></label>
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:font-semibold file:text-white hover:file:bg-brand-700"
            />
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">{t('onboard.peopleWhoNeedLogin')}</h2>
        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{t('onboard.person', { n: i + 1 })}</span>
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(r.id)} className="text-xs text-gray-400 hover:text-red-600">{t('onboard.remove')}</button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">{t('onboard.fullName')}</label>
                  <input className="input" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="label">{t('onboard.emailLoginLabel')}</label>
                  <input className="input" type="email" value={r.email} onChange={(e) => update(r.id, { email: e.target.value })} placeholder="jane@office.ca" autoComplete="off" />
                </div>
                <div>
                  <label className="label">{t('onboard.mobilePhone')}</label>
                  <input className="input" value={r.phone} onChange={(e) => update(r.id, { phone: e.target.value })} placeholder="(705) 555-0123" />
                </div>
                <div>
                  <label className="label">{t('onboard.jobTitleNotes')}</label>
                  <input className="input" value={r.jobTitle} onChange={(e) => update(r.id, { jobTitle: e.target.value })} placeholder={t('onboard.jobTitlePlaceholder')} />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={r.isMainContact} onChange={(e) => update(r.id, { isMainContact: e.target.checked })} className="h-4 w-4" />
                {t('onboard.ownerMainContact')}
              </label>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="btn-secondary mt-3 text-sm">{t('onboard.addAnotherPerson')}</button>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <label className="label">{t('onboard.anythingElse')}</label>
        <textarea className="input" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton disabled={!ready} />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
