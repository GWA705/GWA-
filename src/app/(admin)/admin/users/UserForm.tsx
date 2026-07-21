'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createUserAction, type ActionState } from '@/app/(admin)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Creating…' : 'Create user'}
    </button>
  );
}

export function UserForm({ dealers }: { dealers: { id: string; name: string }[] }) {
  const [state, action] = useFormState(createUserAction, {} as ActionState);
  const [role, setRole] = useState('DEALER_USER');

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
      )}
      {state.ok && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">User created.</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" name="name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select id="role" name="role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="DEALER_USER">Dealer user</option>
            <option value="REVIEWER">Reviewer (internal)</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dealerId">Dealer {role === 'DEALER_USER' ? '(required)' : '(n/a)'}</label>
          <select id="dealerId" name="dealerId" className="input" disabled={role !== 'DEALER_USER'}>
            <option value="">—</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="password">Temporary password</label>
          <input id="password" name="password" type="text" required className="input" placeholder="min 12 chars, mixed case, number, symbol" />
          <p className="mt-1 text-xs text-gray-400">Share securely with the user; they should change it after first login.</p>
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
