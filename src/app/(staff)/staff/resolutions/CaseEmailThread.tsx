'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { linkEmailThreadAction, syncEmailThreadAction, unlinkEmailThreadAction, fetchEmailBodyAction, type CaseFormState } from './actions';
import type { CaseEmailVM } from '@/lib/resolutionCases';
import { useT } from '@/i18n/client';

/** One email: snippet by default, with a "Read full message" toggle that fetches
 *  the full body on demand from Gmail. */
function EmailItem({ caseId, email }: { caseId: string; email: CaseEmailVM }) {
  const t = useT();
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
    } catch { setErr(t('resolution.email.loadError')); }
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
        {loading ? t('common.loading') : open ? `${t('resolution.email.showLess')} ▲` : `${t('resolution.email.readFull')} ▾`}
      </button>
    </li>
  );
}

function LinkBtn() {
  const { pending } = useFormStatus();
  const t = useT();
  return <button type="submit" className="btn-secondary text-sm" disabled={pending}>{pending ? t('resolution.searching') : `🔗 ${t('resolution.email.linkHd')}`}</button>;
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
  const t = useT();
  const router = useRouter();
  const [linkState, linkAction] = useFormState(linkEmailThreadAction.bind(null, caseId), {} as CaseFormState);
  const [, start] = useTransition();

  if (!configured) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400">
        {t('resolution.email.notConfigured')}
      </p>
    );
  }

  if (!linked) {
    return (
      <form action={linkAction} className="space-y-2">
        <p className="text-sm text-gray-500 dark:text-slate-400">{t('resolution.email.findPrompt')}</p>
        {linkState.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{linkState.error}</div>}
        <LinkBtn />
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded border-l-2 border-green-600 bg-green-50 px-1.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">🔗 {t('resolution.email.linkedBadge')}</span>
        <div className="flex items-center gap-3">
          {syncedAt && <span className="text-xs text-gray-400 dark:text-slate-500">{t('resolution.email.syncedLower', { at: syncedAt })}</span>}
          <button type="button" className="text-xs font-medium text-sky-600 hover:underline" onClick={() => start(async () => { await syncEmailThreadAction(caseId); router.refresh(); })}>↻ {t('resolution.email.syncNow')}</button>
          <button type="button" className="text-xs text-gray-400 hover:text-red-600" onClick={() => { if (window.confirm(t('resolution.email.unlinkConfirm'))) start(async () => { await unlinkEmailThreadAction(caseId); router.refresh(); }); }}>{t('resolution.email.unlink')}</button>
        </div>
      </div>

      {emails.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{t('resolution.email.noMessages')}</p>
      ) : (
        <ul className="space-y-2">
          {emails.map((e) => <EmailItem key={e.id} caseId={caseId} email={e} />)}
        </ul>
      )}
      <p className="text-xs text-gray-400 dark:text-slate-500">{t('resolution.email.readOnlyNote')}</p>
    </div>
  );
}
