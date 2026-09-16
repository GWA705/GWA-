'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveDocReminderConfigAction, resetDocReminderConfigAction } from '@/app/(admin)/actions';
import type { DocReminderConfig } from '@/lib/docReminders';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save settings'}
    </button>
  );
}

function Num({
  name,
  label,
  hint,
  value,
  min,
  max,
}: {
  name: keyof DocReminderConfig;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type="number" min={min} max={max} defaultValue={value} className="input" />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function DocReminderConfigForm({ config }: { config: DocReminderConfig }) {
  const [state, action] = useFormState(
    saveDocReminderConfigAction,
    {} as { error?: string; ok?: boolean; message?: string },
  );
  return (
    <form action={action} className="space-y-5">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="h-4 w-4 rounded border-gray-300" />
        Send document-expiry reminders
      </label>

      <label className="flex items-start gap-2 text-sm font-medium text-gray-800">
        <input type="checkbox" name="ccStaff" defaultChecked={config.ccStaff} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
        <span>
          Also CC GWA staff
          <span className="block text-xs font-normal text-gray-400">
            Every Reviewer and Admin account gets an email copy of each reminder, so the office can chase lapsing paperwork. Email only — dealers still get the email + push.
          </span>
        </span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Num name="daysBefore" label="First reminder — days before expiry" hint="Default 7 (one week ahead)." value={config.daysBefore} min={1} max={180} />
        <Num name="resendGapDays" label="Repeat every (days)" hint="Default 7 — resends weekly through/after expiry." value={config.resendGapDays} min={1} max={60} />
        <Num name="maxReminders" label="Stop after (reminders)" hint="Default 6 — then it stops until the document is replaced." value={config.maxReminders} min={1} max={30} />
        <div>
          <label className="label" htmlFor="timezone">Timezone</label>
          <input id="timezone" name="timezone" type="text" defaultValue={config.timezone} className="input" placeholder="America/Toronto" />
          <p className="mt-1 text-xs text-gray-400">IANA name, e.g. America/Toronto. Controls the send-hours window.</p>
        </div>
        <Num name="quietStartHour" label="Don't send before (hour, 0–23)" hint="Default 8 = 8am." value={config.quietStartHour} min={0} max={23} />
        <Num name="quietEndHour" label="Don't send at/after (hour, 1–24)" hint="Default 21 = 9pm." value={config.quietEndHour} min={1} max={24} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && state.message && <span className="text-sm text-green-700">{state.message}</span>}
        <button
          type="submit"
          formAction={resetDocReminderConfigAction}
          className="ml-auto text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Reset to defaults
        </button>
      </div>
    </form>
  );
}
