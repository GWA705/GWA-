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
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{state.message ?? 'User created.'}</div>
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
          <label className="label" htmlFor="dealerId">
            Dealer {role === 'DEALER_USER' ? '(required)' : '(optional — also gives dealer access)'}
          </label>
          <select id="dealerId" name="dealerId" className="input">
            <option value="">—</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {role !== 'DEALER_USER' && (
            <p className="mt-1 text-xs text-gray-400">
              Link this reviewer/admin to a dealer to let them switch into that dealer&apos;s portal with the same login.
            </p>
          )}
        </div>
        {role === 'DEALER_USER' && (
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="isDistributor" className="mt-0.5 rounded border-gray-300" />
              <span>
                This person is the <strong>distributor</strong> (owner / main contact) for this dealer
                <span className="block text-xs text-gray-400">
                  Same access as a dealer user — but flagged as the owner so you can send mail to
                  distributors only.
                </span>
              </span>
            </label>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="password">Temporary password</label>
          <input id="password" name="password" type="text" required className="input" placeholder="e.g. BrightRiver!47" />
          <p className="mt-1 text-xs text-gray-500">
            Must be at least <strong>8 characters</strong> and include an uppercase letter, a
            lowercase letter, a number, and a symbol.
          </p>
          <p className="mt-1 text-xs text-gray-400">The user must change this at first login.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="sendInvite" defaultChecked className="mt-0.5 rounded border-gray-300" />
            <span>
              Email the login details to the user
              <span className="block text-xs text-gray-400">
                Sends the portal address, their username, and the temporary password. If email isn&apos;t
                configured yet, the user is still created — just share the password securely.
              </span>
            </span>
          </label>
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
