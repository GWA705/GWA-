'use client';

import { useState } from 'react';
import { toggleWeeklyEnabledAction, sendTestNationalAction, sendTestStoreAction, sendWeeklyNowAction, sendAllTestAction } from './actions';

function Feedback({ msg, err }: { msg: string | null; err: string | null }) {
  if (err) return <span className="ml-2 text-xs text-red-600">{err}</span>;
  if (msg) return <span className="ml-2 text-xs text-green-600">✓ {msg}</span>;
  return null;
}

export function MasterSwitch({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => { setBusy(true); const r = await toggleWeeklyEnabledAction(); if (r.ok) setOn((v) => !v); setBusy(false); }}
        className={`relative h-7 w-12 flex-none rounded-full transition ${on ? 'bg-green-600' : 'bg-gray-300'}`}
        aria-pressed={on}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      <div>
        <div className="text-sm font-bold text-gray-900">Weekly auto-send: {on ? 'ON' : 'OFF'}</div>
        <div className="text-xs text-gray-500">{on ? 'Reports will send automatically on the Tuesday schedule.' : 'Nothing sends automatically. Preview and test freely.'}</div>
      </div>
    </div>
  );
}

export function SendNowButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={busy}
        onClick={async () => {
          if (!confirm('Send THIS WEEK\'s reports now, for real, to every store and the national list (BCC)? Already-sent reports this week are skipped.')) return;
          setBusy(true); setMsg(null); setErr(null);
          const r = await sendWeeklyNowAction();
          r.ok ? setMsg(r.summary ?? 'Sent') : setErr(r.error ?? 'Failed');
          setBusy(false);
        }}
        className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
        {busy ? 'Sending…' : '🚀 Send this week now (real)'}
      </button>
      {msg && <p className="mt-1 text-xs text-green-700">✓ {msg}</p>}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

export function TestAllButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={busy}
        onClick={async () => { setBusy(true); setMsg(null); setErr(null); const r = await sendAllTestAction(); r.ok ? setMsg(r.summary ?? 'Sent') : setErr(r.error ?? 'Failed'); setBusy(false); }}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        {busy ? 'Sending…' : '✉️ Send me a copy of everything'}
      </button>
      {msg && <p className="mt-1 text-xs text-green-700">✓ {msg}</p>}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

export function TestNationalButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); setMsg(null); setErr(null); const r = await sendTestNationalAction(); r.ok ? setMsg(r.summary ?? 'Sent') : setErr(r.error ?? 'Failed'); setBusy(false); }}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        {busy ? 'Sending…' : '✉️ Send test to me'}
      </button>
      <Feedback msg={msg} err={err} />
    </span>
  );
}

export function TestStoreButton({ storeNumber }: { storeNumber: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="whitespace-nowrap">
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); setMsg(null); setErr(null); const r = await sendTestStoreAction(storeNumber); r.ok ? setMsg('sent') : setErr(r.error ?? 'Failed'); setBusy(false); }}
        className="text-sm font-medium text-brand-700 hover:underline disabled:opacity-50">
        {busy ? 'Sending…' : 'Test to me'}
      </button>
      <Feedback msg={msg} err={err} />
    </span>
  );
}
