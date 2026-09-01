'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { setOnboardCodeAction, type ActionState } from '@/app/(admin)/actions';

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function OnboardCodeForm({ link, currentCode }: { link: string; currentCode: string }) {
  const [state, action] = useFormState(setOnboardCodeAction, {} as ActionState);
  const [copied, setCopied] = useState(false);
  const open = !!currentCode;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">New-dealer intake link</h2>
        <span className={`badge ${open ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {open ? 'Open' : 'Closed'}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Send this link to a new dealer. They fill in their office and the people who need logins, and it
        lands below for you to approve. It only works while a code is set.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input readOnly value={link} className="input min-w-0 flex-1 text-sm text-gray-600" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
        <div>
          <label className="label" htmlFor="onboardCode">Access code</label>
          <input
            id="onboardCode"
            name="code"
            defaultValue={currentCode}
            placeholder="e.g. GWA2026"
            className="input w-48 text-sm"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-400">Include this in your invitation. Clear it to close the form.</p>
        </div>
        <SaveBtn />
        {state.message && <span className="pb-1 text-sm text-emerald-700">{state.message}</span>}
        {state.error && <span className="pb-1 text-sm text-red-600">{state.error}</span>}
      </form>
    </div>
  );
}
