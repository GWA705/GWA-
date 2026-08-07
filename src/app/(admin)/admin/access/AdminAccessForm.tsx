'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { saveAdminAccessAction } from '@/app/(admin)/actions';
import type { ActionState } from '@/app/(admin)/actions';
import type { AdminSection } from '@/lib/constants';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save access'}
    </button>
  );
}

export interface AdminAccessUser {
  id: string;
  name: string;
  email: string;
  superAdmin: boolean;
  sections: string[];
  isSelf: boolean;
}

export function AdminAccessForm({
  user,
  sections,
}: {
  user: AdminAccessUser;
  sections: AdminSection[];
}) {
  const [state, action] = useFormState<ActionState, FormData>(
    saveAdminAccessAction.bind(null, user.id),
    {},
  );
  const [isSuper, setIsSuper] = useState(user.superAdmin);

  return (
    <form action={action} className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div className="min-w-0">
          <div className="font-medium text-gray-900">
            {user.name}
            {user.isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
          </div>
          <div className="truncate text-xs text-gray-500">{user.email}</div>
        </div>
        <label
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            isSuper ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
          }`}
          title={
            user.isSelf
              ? "You can't remove your own Super-Admin access."
              : 'A Super Admin has full access and can manage other admins.'
          }
        >
          <input
            type="checkbox"
            name="superAdmin"
            checked={isSuper}
            disabled={user.isSelf}
            onChange={(e) => setIsSuper(e.target.checked)}
            className="h-4 w-4"
          />
          🔑 Super Admin
        </label>
      </div>

      {state.error && (
        <div className="mx-5 mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
      )}
      {state.ok && state.message && (
        <div className="mx-5 mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{state.message}</div>
      )}

      <fieldset
        disabled={isSuper}
        className={`grid grid-cols-1 gap-x-6 gap-y-1 px-5 py-4 sm:grid-cols-2 ${isSuper ? 'opacity-50' : ''}`}
      >
        {sections.map((s) => (
          <label key={s.key} className="flex items-center justify-between gap-3 rounded px-1 py-2 text-sm hover:bg-gray-50">
            <span className="min-w-0">
              <span className="text-gray-800">{s.label}</span>
              {s.hint && <span className="ml-2 text-xs text-gray-400">{s.hint}</span>}
            </span>
            <input
              type="checkbox"
              name="sections"
              value={s.key}
              defaultChecked={user.sections.includes(s.key)}
              className="h-4 w-4 shrink-0"
            />
          </label>
        ))}
      </fieldset>

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
        <p className="text-xs text-gray-400">
          {isSuper
            ? 'Super Admins have every section — individual toggles are ignored.'
            : 'This admin sees only the switched-on sections. Changes sign them out so access refreshes.'}
        </p>
        <SaveButton />
      </div>
    </form>
  );
}
