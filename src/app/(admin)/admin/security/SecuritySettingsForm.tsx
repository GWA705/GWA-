'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveSecuritySettingsAction } from '@/app/(admin)/actions';
import type { MfaRequirement } from '@/lib/settings';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save security settings'}
    </button>
  );
}

const OPTIONS: { value: MfaRequirement; label: string; hint: string }[] = [
  { value: 'everyone', label: 'Everyone (recommended)', hint: 'All users must set up 2FA at their next sign-in — dealers and staff.' },
  { value: 'staff', label: 'Staff only', hint: 'Only reviewers and admins must use 2FA; dealers may opt in.' },
  { value: 'off', label: 'Optional', hint: 'No one is required to use 2FA (they can still turn it on themselves).' },
];

export function SecuritySettingsForm({ current }: { current: MfaRequirement }) {
  const [state, action] = useFormState(saveSecuritySettingsAction, {} as { error?: string; ok?: boolean; message?: string });
  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="label mb-1">Who must use two-factor authentication</legend>
        {OPTIONS.map((o) => (
          <label key={o.value} className="flex items-start gap-2 rounded-md border border-gray-200 p-3 text-sm">
            <input type="radio" name="mfaRequirement" value={o.value} defaultChecked={current === o.value} className="mt-0.5 h-4 w-4 border-gray-300" />
            <span>
              <span className="font-medium text-gray-800">{o.label}</span>
              <span className="block text-xs text-gray-500">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <SaveButton />
        {state.ok && state.message && <span className="text-sm text-green-700">{state.message}</span>}
      </div>
      <p className="text-xs text-gray-400">
        Users are prompted to set up 2FA the next time they sign in — existing sessions aren&apos;t
        interrupted. Email codes work with no app required; an authenticator app is also offered.
      </p>
    </form>
  );
}
