'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitOnboardRequestAction, type OnboardState } from './actions';

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
  return (
    <button type="submit" className="btn-primary" disabled={pending || disabled}>
      {pending ? 'Sending…' : 'Send request'}
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
        <h2 className="text-base font-semibold text-green-800">Request sent ✓</h2>
        <p className="mt-1 text-sm text-green-700">
          Thanks — Georgian Water &amp; Air will review your request and set up the logins. Each new user
          gets an email to choose a password and turn on two-factor sign-in. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-5 p-6">
      <input type="hidden" name="payload" value={payload} />

      <div>
        <label className="label" htmlFor="accessCode">Access code</label>
        <input id="accessCode" name="accessCode" required className="input sm:max-w-xs" placeholder="From your invitation" autoComplete="off" />
        <p className="mt-1 text-xs text-gray-400">The code Georgian Water &amp; Air gave you in the invitation.</p>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Main contact</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name" value={contactName} onChange={setContactName} placeholder="Jane Doe" />
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="jane@office.ca" />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="(705) 555-0123" />
        </div>
      </div>

      {showOffice && (
        <div className="border-t border-gray-100 pt-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-800">Office details</h2>
          <p className="mb-3 text-xs text-gray-400">So we have everything on file for agreements, payments and future contact.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Operating / office name" value={company} onChange={setCompany} placeholder="Barrie Water Co." />
            <Field label="Legal company name" value={legalName} onChange={setLegalName} placeholder="1234567 Ontario Inc." hint="If different from the operating name" />
            <Field label="Office phone" value={officePhone} onChange={setOfficePhone} placeholder="(705) 555-0100" />
            <Field label="Office email" value={officeEmail} onChange={setOfficeEmail} type="email" placeholder="office@company.ca" />
            <Field label="Website" value={website} onChange={setWebsite} placeholder="www.company.ca" hint="Optional — your public site" />
          </div>
          <div className="mt-3">
            <Field label="Street address" value={address} onChange={setAddress} placeholder="123 Main St, Unit 4" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="City / town" value={city} onChange={setCity} placeholder="Barrie" />
            <Field label="Province" value={province} onChange={setProvince} placeholder="ON" />
            <Field label="Postal code" value={postal} onChange={setPostal} placeholder="L4M 1A1" />
          </div>
          <div className="mt-3">
            <label className="label">Mailing address <span className="font-normal text-gray-400">(only if different from above)</span></label>
            <textarea className="input" rows={2} value={mailingAddress} maxLength={300} onChange={(e) => setMailingAddress(e.target.value)} placeholder="PO Box 123, Barrie ON L4M 1A1" />
          </div>
          <div className="mt-3">
            <label className="label">Company logo <span className="font-normal text-gray-400">(optional — PNG, JPG or WEBP, up to 4&nbsp;MB)</span></label>
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
        <h2 className="mb-3 text-sm font-semibold text-gray-800">People who need a login</h2>
        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Person {i + 1}</span>
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(r.id)} className="text-xs text-gray-400 hover:text-red-600">Remove</button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="label">Email (this becomes their login)</label>
                  <input className="input" type="email" value={r.email} onChange={(e) => update(r.id, { email: e.target.value })} placeholder="jane@office.ca" autoComplete="off" />
                </div>
                <div>
                  <label className="label">Mobile phone</label>
                  <input className="input" value={r.phone} onChange={(e) => update(r.id, { phone: e.target.value })} placeholder="(705) 555-0123" />
                </div>
                <div>
                  <label className="label">Job title / notes</label>
                  <input className="input" value={r.jobTitle} onChange={(e) => update(r.id, { jobTitle: e.target.value })} placeholder="Office manager" />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={r.isMainContact} onChange={(e) => update(r.id, { isMainContact: e.target.checked })} className="h-4 w-4" />
                Owner / main contact for the office (distributor access)
              </label>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="btn-secondary mt-3 text-sm">+ Add another person</button>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <label className="label">Anything else for Georgian Water &amp; Air? (optional)</label>
        <textarea className="input" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton disabled={!ready} />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
