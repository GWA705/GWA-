'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitUserRequestAction } from '@/app/(dealer)/actions';
import type { ActionState } from '@/app/(dealer)/actions';

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
      {pending ? 'Sending…' : 'Request distributor access'}
    </button>
  );
}

export function UserRequestForm() {
  const [state, action] = useFormState(submitUserRequestAction, {} as ActionState);
  const [rows, setRows] = useState<Row[]>([blank(1)]);
  const [note, setNote] = useState('');
  const [nextId, setNextId] = useState(2);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form after a successful submit.
  if (state.ok && rows.length === 1 && rows[0].name === '' && note !== '__done__') {
    // no-op guard; real reset handled below via key change
  }

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
    note,
    rows: rows.map(({ name, email, phone, jobTitle, isMainContact }) => ({ name, email, phone, jobTitle, isMainContact })),
  });

  const anyFilled = rows.some((r) => r.name.trim() || r.email.trim());

  if (state.ok) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-5">
        <h3 className="text-sm font-semibold text-green-800">Request sent ✓</h3>
        <p className="mt-1 text-sm text-green-700">
          GWA will review it and set up the logins. Each new user gets an email to set their password
          and turn on two-factor authentication. You’ll see the status update below.
        </p>
        <button
          type="button"
          className="btn-secondary mt-3 text-sm"
          onClick={() => {
            setRows([blank(1)]);
            setNote('');
            setNextId(2);
            // Clear the action state by reloading the route data.
            window.location.reload();
          }}
        >
          Request more users
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={r.id} className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Person {i + 1}</span>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(r.id)} className="text-xs text-gray-400 hover:text-red-600">
                  Remove
                </button>
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
              This person is the owner / main contact for the office
            </label>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="btn-secondary text-sm">+ Add another person</button>

      <div>
        <label className="label">Anything else for GWA? (optional)</label>
        <textarea className="input" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton disabled={!anyFilled} />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
