'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveVoiceSettingsAction } from '@/app/(admin)/actions';
import type { ActionState } from '@/app/(admin)/actions';

interface Config {
  clickToCall: boolean;
  bookingLine: string;
  fromNumber: string;
  hoursStart: number;
  hoursEnd: number;
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save live-call settings'}</button>;
}

export function VoiceSettingsForm({ config, credsPresent }: { config: Config; credsPresent: boolean }) {
  const [state, action] = useFormState(saveVoiceSettingsAction, {} as ActionState);
  return (
    <form action={action} className="space-y-5">
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{state.message}</div>}

      {!credsPresent && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Voice uses your Twilio account (<code>TWILIO_ACCOUNT_SID</code> / <code>TWILIO_AUTH_TOKEN</code>). They aren’t set
          on the environment yet, so calls can’t be placed until they are.
        </div>
      )}

      <label className="flex items-start gap-3">
        <input type="checkbox" name="clickToCall" defaultChecked={config.clickToCall} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium text-gray-900">Offer &ldquo;talk to a booker now&rdquo; on the booking page</span>
          <span className="block text-xs text-gray-500">
            During staffed hours, the customer can tap to connect. The portal rings the bookers&rsquo; line first; when a
            booker answers, it dials the customer and bridges the call. Outside hours it falls back to a call-back request.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Bookers’ line (rings first)</span>
          <input name="bookingLine" defaultValue={config.bookingLine} placeholder="705-555-0123 or 1-866-…" className="input" autoComplete="off" />
        </label>
        <label className="block">
          <span className="label">Caller ID shown to the customer <span className="font-normal text-gray-400">(optional)</span></span>
          <input name="fromNumber" defaultValue={config.fromNumber} placeholder="defaults to your Twilio number" className="input" autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Offer calls after (local hour)</span>
          <input name="hoursStart" type="number" min={0} max={23} defaultValue={config.hoursStart} className="input" />
        </label>
        <label className="block">
          <span className="label">…and before (local hour)</span>
          <input name="hoursEnd" type="number" min={1} max={24} defaultValue={config.hoursEnd} className="input" />
        </label>
      </div>
      <p className="-mt-2 text-xs text-gray-400">In the customer’s provincial time zone. Default 9 to 21 (9am–9pm).</p>

      <SaveBtn />
    </form>
  );
}
