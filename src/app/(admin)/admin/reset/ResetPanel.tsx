'use client';

import { useState, useTransition } from 'react';
import { wipeDealsAction, wipeMailAction } from '../../actions';

type DealSummary = { deals: number; files: number; notes: number; decisions: number; payouts: number };
type MailSummary = { mails: number; replies: number; attachments: number };

function Card({
  title,
  blurb,
  count,
  detail,
  phrase,
  run,
}: {
  title: string;
  blurb: string;
  count: number;
  detail: string;
  phrase: string;
  run: (confirm: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
}) {
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const armed = confirm.trim().toUpperCase() === phrase && count > 0;

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-sm text-gray-600">{blurb}</p>
        </div>
        <span className="badge shrink-0 bg-gray-100 text-gray-700">{count} to remove</span>
      </div>
      <p className="text-xs text-gray-500">{detail}</p>

      {count === 0 ? (
        <p className="text-sm text-gray-500">Nothing to remove — already clean.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={`Type ${phrase} to confirm`}
            className="input max-w-xs text-sm"
            aria-label={`Type ${phrase} to confirm`}
          />
          <button
            type="button"
            disabled={!armed || pending}
            onClick={() =>
              startTransition(async () => {
                const r = await run(confirm);
                setMsg({ ok: r.ok, text: r.ok ? r.message || 'Done.' : r.error || 'Failed.' });
                if (r.ok) setConfirm('');
              })
            }
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? 'Removing…' : title}
          </button>
        </div>
      )}
      {msg && <div className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</div>}
    </div>
  );
}

export function ResetPanel({ deals, mail }: { deals: DealSummary; mail: MailSummary }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        title="Delete all deals"
        blurb="Every customer application and everything attached to it."
        count={deals.deals}
        detail={`Includes ${deals.notes} note(s), ${deals.decisions} decision(s), ${deals.payouts} payout(s), ${deals.files} uploaded file(s), and related audit entries. Keeps marketplace, resources, dealers, users and settings.`}
        phrase="DELETE DEALS"
        run={wipeDealsAction}
      />
      <Card
        title="Delete all mail"
        blurb="Every message and its replies/attachments."
        count={mail.mails}
        detail={`Includes ${mail.replies} repl(y/ies) and ${mail.attachments} attachment(s), plus read receipts. Keeps everything else.`}
        phrase="DELETE MAIL"
        run={wipeMailAction}
      />
    </div>
  );
}
