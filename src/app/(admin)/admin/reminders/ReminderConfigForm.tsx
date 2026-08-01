'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveReminderConfigAction, resetReminderConfigAction } from '@/app/(admin)/actions';
import type { ReminderConfig } from '@/lib/reminders';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save rules'}
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
  name: keyof ReminderConfig;
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

export function ReminderConfigForm({ config }: { config: ReminderConfig }) {
  const [state, action] = useFormState(
    saveReminderConfigAction,
    {} as { error?: string; ok?: boolean; message?: string },
  );
  return (
    <form action={action} className="space-y-5">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="h-4 w-4 rounded border-gray-300" />
        Send dealer reminders
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Num name="graceHours" label="Wait before the first reminder (hours)" hint="Default 24 — give the dealer the first day." value={config.graceHours} min={0} max={240} />
        <Num name="maxPerDay" label="Most reminders in one day" hint="Default 2 (day-1 morning + afternoon)." value={config.maxPerDay} min={1} max={6} />
        <Num name="quietStartHour" label="Don't send before (hour, 0–23)" hint="Default 8 = 8am." value={config.quietStartHour} min={0} max={23} />
        <Num name="quietEndHour" label="Don't send at/after (hour, 1–24)" hint="Default 21 = 9pm." value={config.quietEndHour} min={1} max={24} />
        <Num name="morningHour" label="Morning send hour" hint="The daily reminder fires at/after this hour. Default 8." value={config.morningHour} min={0} max={23} />
        <Num name="afternoonHour" label="Day-1 afternoon send hour" hint="The second day-1 reminder. Default 15 = ~3pm." value={config.afternoonHour} min={0} max={23} />
        <Num name="everyOtherUntilDay" label="Every-other-day phase ends on day" hint="Default 5 — after this, it drops to twice a week." value={config.everyOtherUntilDay} min={2} max={30} />
        <Num name="priorityAfterDay" label="Mark as priority after day" hint="Default 5 — later reminders are flagged ⚠️ priority." value={config.priorityAfterDay} min={0} max={60} />
        <Num name="twiceWeeklyGapHours" label="Gap between twice-a-week reminders (hours)" hint="Default 84 (~3.5 days) → about twice a week." value={config.twiceWeeklyGapHours} min={24} max={336} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && state.message && <span className="text-sm text-green-700">{state.message}</span>}
        <button
          type="submit"
          formAction={resetReminderConfigAction}
          className="ml-auto text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          Reset to defaults
        </button>
      </div>
    </form>
  );
}
