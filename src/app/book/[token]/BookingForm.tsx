'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitBookingRequestAction, type BookingState } from '../actions';
import { BOOKING_WINDOW_LABEL } from '@/lib/bookingWindows';

const WINDOWS = ['MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME'] as const;

// The next 14 days as { value: 'YYYY-MM-DD', label: 'Tue, Oct 14' }.
function nextDays(n: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i += 1) {
    const d = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
    out.push({ value, label: i === 0 ? `Today — ${label}` : label });
  }
  return out;
}

function RequestBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50" disabled={pending}>
      {pending ? 'Sending…' : 'Request this time'}
    </button>
  );
}
function CallNowBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="callNow" value="1" className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50" disabled={pending}>
      📞 Call me as soon as possible
    </button>
  );
}

export function BookingForm({ token, firstName, canCallNow }: { token: string; firstName: string; canCallNow: boolean }) {
  const [state, action] = useFormState(submitBookingRequestAction, {} as BookingState);
  const days = nextDays(14);

  // Live "connect me to a booker now" — only when staffed hours + voice is on.
  const [call, setCall] = useState<'idle' | 'calling' | 'connected' | 'failed'>('idle');
  async function liveCall() {
    setCall('calling');
    try {
      const r = await fetch('/api/book/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const j = await r.json().catch(() => ({ ok: false }));
      setCall(j.ok ? 'connected' : 'failed');
    } catch {
      setCall('failed');
    }
  }

  if (call === 'connected') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="text-2xl">📞</div>
        <h2 className="mt-2 text-base font-semibold text-gray-900">Calling you now</h2>
        <p className="mt-1 text-sm text-gray-600">Your phone will ring in a moment — a Georgian Water &amp; Air booker is on the line. You can close this page.</p>
      </div>
    );
  }

  if (state.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="text-2xl">✅</div>
        <h2 className="mt-2 text-base font-semibold text-gray-900">
          {state.callNow ? 'Got it — we’ll call you shortly.' : 'Thanks — we’ve got your preferred time.'}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          A team member from Georgian Water &amp; Air will {state.callNow ? 'call you as soon as possible' : 'call to confirm your in-home water assessment'}.
          You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}

      <div>
        <label htmlFor="day" className="mb-1 block text-sm font-medium text-gray-800">What day works best{firstName ? `, ${firstName}` : ''}?</label>
        <select id="day" name="day" defaultValue="" className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm">
          <option value="">Choose a day…</option>
          {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-gray-800">What time of day?</span>
        <div className="grid grid-cols-2 gap-2">
          {WINDOWS.map((w) => (
            <label key={w} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50 has-[:checked]:font-semibold">
              <input type="radio" name="window" value={w} className="h-4 w-4" />
              {BOOKING_WINDOW_LABEL[w]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-gray-800">Anything we should know? <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea id="note" name="note" rows={2} maxLength={500} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm" placeholder="Gate code, best entrance, etc." />
      </div>

      <div className="space-y-2 pt-1">
        <RequestBtn />
        <div className="flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />or<span className="h-px flex-1 bg-gray-200" /></div>
        {canCallNow && call !== 'failed' ? (
          <button
            type="button"
            onClick={liveCall}
            disabled={call === 'calling'}
            className="w-full rounded-lg border border-gray-900 bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {call === 'calling' ? 'Connecting…' : '📞 Talk to a booker now'}
          </button>
        ) : (
          <>
            {call === 'failed' && <p className="text-center text-xs text-gray-500">Couldn’t connect a call right now — we’ll call you instead.</p>}
            <CallNowBtn />
          </>
        )}
      </div>
    </form>
  );
}
