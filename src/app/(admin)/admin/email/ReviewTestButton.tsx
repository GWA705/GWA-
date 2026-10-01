'use client';

import { useState, useTransition } from 'react';
import { sendReviewTestAction } from '@/app/(staff)/actions';

/**
 * Admin button to send a TEST of the customer review email to yourself, so you
 * can confirm the real thing (co-brand logo, gold stars, From Reporter@, layout)
 * renders and delivers in Gmail / Outlook.
 */
export function ReviewTestButton({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      const r = await sendReviewTestAction();
      if (r.error) { setMsg({ kind: 'err', text: r.error }); return; }
      setMsg({ kind: 'ok', text: `Test sent to ${r.sentTo} — check your inbox (and spam).${r.note ? ' ' + r.note : ''}` });
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={pending || !enabled}
        className="btn-primary disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send me the review email'}
      </button>
      {!enabled && <p className="mt-2 text-xs text-amber-700">Turn on sending first (badge above).</p>}
      {msg && (
        <p className={`mt-3 rounded-md border-l-4 p-2 text-sm ${msg.kind === 'ok' ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
