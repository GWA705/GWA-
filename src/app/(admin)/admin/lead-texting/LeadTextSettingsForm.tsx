'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveLeadTextSettingsAction, sendLeadTextTestAction } from '@/app/(admin)/actions';
import type { ActionState } from '@/app/(admin)/actions';

interface Config {
  enabled: boolean;
  testMode: boolean;
  testNumber: string;
  mediaUrl: string;
  senderMap: string;
  quietStart: number;
  quietEnd: number;
  followups: boolean;
  day1Hours: number;
  missHours: number;
  bookingLink: boolean;
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button>;
}
function TestBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-secondary text-sm" disabled={pending}>{pending ? 'Sending…' : 'Send sample to test number'}</button>;
}

export function LeadTextSettingsForm({ config }: { config: Config }) {
  const [saveState, saveAction] = useFormState(saveLeadTextSettingsAction, {} as ActionState);
  const [testState, testAction] = useFormState(sendLeadTextTestAction, {} as ActionState);

  return (
    <div className="space-y-6">
      <form action={saveAction} className="space-y-5">
        {saveState.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{saveState.error}</div>}
        {saveState.ok && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{saveState.message}</div>}

        <label className="flex items-start gap-3">
          <input type="checkbox" name="enabled" defaultChecked={config.enabled} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="font-medium text-gray-900">Turn the auto-text on</span>
            <span className="block text-xs text-gray-500">When off, nothing is queued or sent — the whole feature sleeps.</span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input type="checkbox" name="testMode" defaultChecked={config.testMode} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="font-medium text-gray-900">Test mode</span>
            <span className="block text-xs text-gray-500">Every text goes to your test number instead of the real customer. Leave this ON until the sending number is verified and you’ve seen a sample land.</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Test number</span>
            <input name="testNumber" defaultValue={config.testNumber} placeholder="705-555-0123" className="input" autoComplete="off" />
          </label>
          <label className="block">
            <span className="label">MMS image URL (optional)</span>
            <input name="mediaUrl" defaultValue={config.mediaUrl} placeholder="https://portal.ghsbarrie.ca/…png" className="input" autoComplete="off" />
          </label>
        </div>
        <p className="-mt-2 text-xs text-gray-400">The image must be a public URL Twilio can fetch. Leave blank to send plain SMS only.</p>

        <label className="block">
          <span className="label">Sending numbers by province (JSON)</span>
          <textarea
            name="senderMap"
            defaultValue={config.senderMap}
            rows={4}
            className="input font-mono text-xs"
            placeholder={'{\n  "default": "+18665550123",\n  "ON": "+17055550123"\n}'}
            autoComplete="off"
          />
        </label>
        <p className="-mt-2 text-xs text-gray-400">
          <code>default</code> is used for every province without its own number. Leave blank to use the single
          <code> TWILIO_FROM_NUMBER</code>. Each number must be verified for Canada.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Send only after (local hour)</span>
            <input name="quietStart" type="number" min={0} max={23} defaultValue={config.quietStart} className="input" />
          </label>
          <label className="block">
            <span className="label">…and before (local hour)</span>
            <input name="quietEnd" type="number" min={1} max={24} defaultValue={config.quietEnd} className="input" />
          </label>
        </div>
        <p className="-mt-2 text-xs text-gray-400">In the customer’s provincial time zone. Default 8 to 21 (8am–9pm). Overnight leads wait for morning.</p>

        <div className="border-t border-gray-100 pt-5">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="followups" defaultChecked={config.followups} className="mt-0.5 h-4 w-4" />
            <span>
              <span className="font-medium text-gray-900">Send follow-up texts</span>
              <span className="block text-xs text-gray-500">
                For scanned &amp; mail-in leads: a day-1 reminder, then a &ldquo;sorry, we&rsquo;ll call again within 36 hours&rdquo;
                message if the window is missed. Each one cancels automatically the moment the lead is marked contacted, booked, or opts out.
                HD online-log leads get the confirmation only.
              </span>
            </span>
          </label>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Day-1 reminder after (hours)</span>
              <input name="day1Hours" type="number" min={1} max={168} defaultValue={config.day1Hours} className="input" />
            </label>
            <label className="block">
              <span className="label">Missed-window text after (hours)</span>
              <input name="missHours" type="number" min={2} max={168} defaultValue={config.missHours} className="input" />
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-400">Default 24 then 48 hours — matching the 24–48 hr call promise. The missed-window text must come after the day-1 one.</p>

          <label className="mt-4 flex items-start gap-3">
            <input type="checkbox" name="bookingLink" defaultChecked={config.bookingLink} className="mt-0.5 h-4 w-4" />
            <span>
              <span className="font-medium text-gray-900">Include a &ldquo;book a time yourself&rdquo; link in the follow-ups</span>
              <span className="block text-xs text-gray-500">
                Adds a link to the customer self-booking page to the day-1 and missed-window texts, so a customer can request
                their preferred time 24/7 instead of waiting for a call. Leave off until you&rsquo;re ready to field self-bookings.
              </span>
            </span>
          </label>
        </div>

        <SaveBtn />
      </form>

      <form action={testAction} className="space-y-3 border-t border-gray-100 pt-5">
        <h3 className="text-sm font-semibold text-gray-900">Send a sample</h3>
        {testState.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{testState.error}</div>}
        {testState.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">{testState.message}</div>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label">Source</span>
            <select name="source" className="input min-w-[160px]" defaultValue="SCANNED">
              <option value="SCANNED">In-store card</option>
              <option value="MAILIN">Mail-in card</option>
              <option value="HD_SHEET">Online HD lead</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Province</span>
            <select name="province" className="input min-w-[120px]" defaultValue="ON">
              {['ON', 'QC', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <TestBtn />
        </div>
        <p className="text-xs text-gray-400">Sends one real text to your saved test number using the configured image + sender — a good final check before going live.</p>
      </form>
    </div>
  );
}
