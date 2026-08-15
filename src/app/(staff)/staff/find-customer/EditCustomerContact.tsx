'use client';

import { useState, useTransition } from 'react';
import { updateCustomerInfoAction } from '@/app/(dealer)/dealer/find-customer/actions';

// Staff-side editor for a customer's contact details on the assist page.
// Corrections are stored as an override; the original application is untouched.
export function EditCustomerContact({
  applicationId,
  customerName,
  initial,
  updatedAt,
  updatedByName,
}: {
  applicationId: string;
  customerName: string;
  initial: { phone: string; address: string; email: string };
  updatedAt: string | null;
  updatedByName: string | null;
}) {
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [email, setEmail] = useState(initial.email);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [stampAt, setStampAt] = useState(updatedAt);
  const [stampBy, setStampBy] = useState(updatedByName);

  // draft values while editing
  const [dPhone, setDPhone] = useState(phone);
  const [dAddress, setDAddress] = useState(address);
  const [dEmail, setDEmail] = useState(email);

  function open() {
    setDPhone(phone); setDAddress(address); setDEmail(email);
    setMsg(null); setEditing(true);
  }
  function save() {
    setMsg(null);
    start(async () => {
      const r = await updateCustomerInfoAction({ applicationId, customerName, phone: dPhone, address: dAddress, email: dEmail });
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setPhone(dPhone); setAddress(dAddress); setEmail(dEmail);
        if (r.updatedAt) setStampAt(r.updatedAt);
        if (r.updatedByName) setStampBy(r.updatedByName);
        setEditing(false);
      }
    });
  }
  const when = stampAt ? new Date(stampAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Customer contact</h2>
        <button type="button" onClick={() => (editing ? setEditing(false) : open())} className="text-xs font-semibold text-gray-500 hover:text-gray-700 hover:underline">
          {editing ? 'Cancel' : '✎ Edit'}
        </button>
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-700 sm:grid-cols-2">
          <div>Phone: <span className="font-medium text-gray-900">{phone || '—'}</span></div>
          <div>Email: <span className="font-medium text-gray-900">{email || '—'}</span></div>
          <div className="sm:col-span-2">Address: <span className="font-medium text-gray-900">{address || '—'}</span></div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Phone</span>
              <input className="input mt-0.5" value={dPhone} onChange={(e) => setDPhone(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Email</span>
              <input className="input mt-0.5" type="email" value={dEmail} onChange={(e) => setDEmail(e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Address</span>
              <input className="input mt-0.5" value={dAddress} onChange={(e) => setDAddress(e.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={pending} className="btn-primary text-sm">
              {pending ? 'Saving…' : 'Save changes'}
            </button>
            <span className="text-[11px] text-gray-400">Updates this customer across the portal. The sales journal is left unchanged.</span>
          </div>
        </div>
      )}

      {msg && <div className={`mt-2 rounded-md px-3 py-2 text-xs ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
      {when && !editing && <p className="mt-2 text-[11px] text-gray-400">✎ Updated {when}{stampBy ? ` by ${stampBy}` : ''} · sales journal unchanged</p>}
    </section>
  );
}
