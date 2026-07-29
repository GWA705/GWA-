'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateProfileAction, type ActionState } from '@/app/(account)/actions';

interface Profile {
  name: string;
  email: string;
  phone: string | null;
  notificationEmail: string | null;
  notifyStatusUpdates: boolean;
  notifyNewNotes: boolean;
  notifyNewDocuments: boolean;
  isStaff: boolean;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save profile'}
    </button>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-gray-300" />
      {label}
    </label>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useFormState(updateProfileAction, {} as ActionState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">Profile saved.</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" defaultValue={profile.name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" defaultValue={profile.phone ?? ''} className="input" placeholder="705-716-2111" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notificationEmail">Notification email <span className="font-normal text-gray-400">(leave blank to use {profile.email})</span></label>
          <input id="notificationEmail" name="notificationEmail" type="email" defaultValue={profile.notificationEmail ?? ''} className="input" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">Email me when…</h3>
        <div className="space-y-2">
          {profile.isStaff ? (
            <Toggle name="notifyNewDocuments" label="A dealer uploads new documents" defaultChecked={profile.notifyNewDocuments} />
          ) : (
            <Toggle name="notifyStatusUpdates" label="A deal's status changes" defaultChecked={profile.notifyStatusUpdates} />
          )}
          <Toggle name="notifyNewNotes" label="A new note is added on a deal" defaultChecked={profile.notifyNewNotes} />
        </div>
        <p className="mt-2 text-xs text-gray-400">Email is the only channel today. (Text messaging can be added later.)</p>
      </div>

      <SubmitButton />
    </form>
  );
}
