'use client';

import { useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { linkEmailThreadAction, syncEmailThreadAction, unlinkEmailThreadAction, type CaseFormState } from './actions';
import type { CaseEmailVM } from '@/lib/resolutionCases';

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
          {emails.map((e) => (
            <li key={e.id} className="rounded-lg border border-gray-100 bg-slate-50/60 p-2.5 dark:border-slate-700 dark:bg-slate-700/30">
              <div className="mb-0.5 text-xs text-gray-500 dark:text-slate-400">✉️ {e.fromAddr} · {e.at}</div>
              <div className="text-sm text-gray-800 dark:text-slate-100">{e.snippet}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400 dark:text-slate-500">Read-only summaries of the HD email chain — open Gmail for the full message.</p>
    </div>
  );
}
