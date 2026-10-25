'use client';

import { useState, useTransition } from 'react';
import { sendIdTagEmailPreviewAction } from './actions';

/**
 * "Email me a preview" — sends the current admin the real generated ID-tag
 * emails (new-rep background-screening + existing-rep welcome) with the live
 * settings, so they can see exactly what a rep receives before anyone's sent one.
 */
export function IdTagPreviewButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      const res = await sendIdTagEmailPreviewAction();
      setMsg({ ok: !!res.ok, text: res.message || res.error || '' });
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Email me a preview'}
      </button>
      {msg && (
        <p className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>
      )}
    </div>
  );
}
