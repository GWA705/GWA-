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

export function OnboardForm() {
  const [state, action] = useFormState(submitOnboardRequestAction, {} as OnboardState);
  const [rows, setRows] = useState<Row[]>([blank(1)]);
  const [nextId, setNextId] = useState(2);
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
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
    company,
    contactName,
    email,
    phone,
    city,
    note,
    people: rows.map(({ name, email: e, phone: p, jobTitle, isMainContact }) => ({ name, email: e, phone: p, jobTitle, isMainContact })),
  });
  const ready = company.trim() && contactName.trim() && email.trim() && rows.some((r) => r.name.trim() && r.email.trim());

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
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Your office</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Company / office name</label>
            <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Barrie Water Co." />
          </div>
          <div>
            <label className="label">City / town</label>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Barrie, ON" />
          </div>
          <div>
            <label className="label">Main contact name</label>
            <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <label className="label">Contact email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@office.ca" autoComplete="off" />
          </div>
          <div>
            <label className="label">Contact phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(705) 555-0123" />
          </div>
        </div>
      </div>

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
