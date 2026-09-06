'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateProfileAction, type ActionState } from '@/app/(account)/actions';
import { useT } from '@/i18n/client';

interface Profile {
  name: string;
  email: string;
  phone: string | null;
  notificationEmail: string | null;
  notifyStatusUpdates: boolean;
  notifyNewNotes: boolean;
  notifyNewDocuments: boolean;
  notifyAttentionAlerts: boolean;
  notifyIdleReminders: boolean;
  notifyNewLeads: boolean;
  isStaff: boolean;
}

function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('account.saving') : t('account.saveProfile')}
    </button>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  const t = useT();
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => {
          const next = e.target.checked;
          // Turning a notification OFF is a decision worth confirming — the user
          // may miss important updates. Turning one back on needs no prompt.
          if (!next) {
            const ok = window.confirm(t('account.turnOffConfirm', { label }));
            if (!ok) return; // keep it on
          }
          setChecked(next);
        }}
        className="h-4 w-4 rounded border-gray-300"
      />
      {label}
    </label>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useT();
  const [state, action] = useFormState(updateProfileAction, {} as ActionState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">{t('account.profileSaved')}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">{t('account.name')}</label>
          <input id="name" name="name" defaultValue={profile.name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">{t('account.phone')}</label>
          <input id="phone" name="phone" defaultValue={profile.phone ?? ''} className="input" placeholder="705-812-0320" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notificationEmail">{t('account.notificationEmail')} <span className="font-normal text-gray-400">{t('account.notificationEmailHint', { email: profile.email })}</span></label>
          <input id="notificationEmail" name="notificationEmail" type="email" defaultValue={profile.notificationEmail ?? ''} className="input" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">{t('account.notifyWhen')}</h3>
        <div className="space-y-2">
          {profile.isStaff ? (
            <>
              <Toggle name="notifyNewDocuments" label={t('account.notifyNewDocuments')} defaultChecked={profile.notifyNewDocuments} />
              <Toggle name="notifyAttentionAlerts" label={t('account.notifyAttentionAlerts')} defaultChecked={profile.notifyAttentionAlerts} />
            </>
          ) : (
            <>
              <Toggle name="notifyNewLeads" label={t('account.notifyNewLeads')} defaultChecked={profile.notifyNewLeads} />
              <Toggle name="notifyStatusUpdates" label={t('account.notifyStatusUpdates')} defaultChecked={profile.notifyStatusUpdates} />
              <Toggle name="notifyIdleReminders" label={t('account.notifyIdleReminders')} defaultChecked={profile.notifyIdleReminders} />
            </>
          )}
          <Toggle name="notifyNewNotes" label={t('account.notifyNewNotes')} defaultChecked={profile.notifyNewNotes} />
        </div>
        <p className="mt-2 text-xs text-gray-400">{t('account.notifyFootnote')}</p>
      </div>

      <SubmitButton />
    </form>
  );
}
