'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { linkEmailThreadAction, syncEmailThreadAction, unlinkEmailThreadAction, fetchEmailBodyAction, type CaseFormState } from './actions';
import type { CaseEmailVM } from '@/lib/resolutionCases';

/** One email: snippet by default, with a "Read full message" toggle that fetches
 *  the full body on demand from Gmail. */
function EmailItem({ caseId, email }: { caseId: string; email: CaseEmailVM }) {
  const [full, setFull] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    if (open) { setOpen(false); return; }
    if (full) { setOpen(true); return; }
    setLoading(true); setErr(null);
    try {
      const r = await fetchEmailBodyAction(caseId, email.gmailMessageId);
      if (r.error) setErr(r.error);
      else { setFull(r.text ?? ''); setOpen(true); }
    } catch { setErr('Couldn’t load the message — try again.'); }
    finally { setLoading(false); }
  }

  return (
    <li className="rounded-lg border border-gray-100 bg-slate-50/60 p-2.5 dark:border-slate-700 dark:bg-slate-700/30">
      <div className="mb-0.5 text-xs text-gray-500 dark:text-slate-400">✉️ {email.fromAddr} · {email.at}</div>
      {open && full ? (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-slate-100">{full}</div>
      ) : (
        <div className="text-sm text-gray-800 dark:text-slate-100">{email.snippet}</div>
      )}
      {err && <p className="mt-1 text-xs text-amber-600">{err}</p>}
      <button type="button" onClick={toggle} disabled={loading} className="mt-1 text-xs font-medium text-sky-600 hover:underline disabled:opacity-50">
        {loading ? 'Loading…' : open ? 'Show less ▲' : 'Read full message ▾'}
      </button>
    </li>
  );
}

function LinkBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-secondary text-sm" disabled={pending}>{pending ? 'Searching…' : '🔗 Link HD email'}</button>;
}

export function CaseEmailThread({
  caseId,
  configured,
  linked,
  syncedAt,
  emails,
}: {
  caseId: string;
  configured: boolean;
  linked: boolean;
  syncedAt: string | null;
  emails: CaseEmailVM[];
}) {
  const router = useRouter();
  const [linkState, linkAction] = useFormState(linkEmailThreadAction.bind(null, caseId), {} as CaseFormState);
  const [, start] = useTransition();

  if (!configured) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400">
        The Gmail email link isn&apos;t set up yet. Once the &quot;HD Resolution&quot; label + read-only access are configured, you can link this case to its HD email chain here.
      </p>
    );
  }

  if (!linked) {
    return (
      <form action={linkAction} className="space-y-2">
        <p className="text-sm text-gray-500 dark:text-slate-400">Find this case&apos;s HD email chain by its HD Ref # / case number and follow it automatically.</p>
        {linkState.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{linkState.error}</div>}
        <LinkBtn />
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded border-l-2 border-green-600 bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">🔗 Linked to Gmail thread</span>
        <div className="flex items-center gap-3">
          {syncedAt && <span className="text-xs text-gray-400 dark:text-slate-500">synced {syncedAt}</span>}
          <button type="button" className="text-xs font-medium text-sky-600 hover:underline" onClick={() => start(async () => { await syncEmailThreadAction(caseId); router.refresh(); })}>↻ Sync now</button>
          <button type="button" className="text-xs text-gray-400 hover:text-red-600" onClick={() => { if (window.confirm('Unlink this email thread and drop its synced messages?')) start(async () => { await unlinkEmailThreadAction(caseId); router.refresh(); }); }}>Unlink</button>
        </div>
      </div>

      {emails.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">No messages pulled yet — press Sync, or new replies arrive automatically.</p>
      ) : (
        <ul className="space-y-2">
          {emails.map((e) => <EmailItem key={e.id} caseId={caseId} email={e} />)}
        </ul>
      )}
      <p className="text-xs text-gray-400 dark:text-slate-500">Read-only — &quot;Read full message&quot; pulls the whole email from Gmail; replies are drafted below.</p>
    </div>
  );
}
