import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { gmailResolutionConfigured, listUnlinkedThreads, resolutionLabel, parseHdSubject, type GmailThreadSummary } from '@/lib/gmailResolution';
import { decodeEntities } from '@/lib/htmlEntities';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

// Build the "Open as case" link, pre-filling everything we can parse from the
// email subject: the thread link, title, HD Case #, HD Ref #, and customer name.
// The new-case page uses the HD Ref # to match an existing deal (and auto-link it).
function openAsCaseHref(threadId: string, subject: string): string {
  const p = parseHdSubject(subject);
  const params = new URLSearchParams({ gmailThreadId: threadId, title: decodeEntities(subject) });
  if (p.caseNumber) params.set('hdCase', p.caseNumber);
  if (p.hdRef) params.set('hdRef', p.hdRef);
  if (p.lastName) params.set('name', p.lastName);
  return `/staff/resolutions/new?${params.toString()}`;
}

export default async function ResolutionInboxPage() {
  await requireRole('REVIEWER', 'ADMIN');
  const t = getT();

  const configured = gmailResolutionConfigured();
  let threads: GmailThreadSummary[] = [];
  let error: string | null = null;

  if (configured) {
    try {
      const linked = await prisma.resolutionCase.findMany({
        where: { gmailThreadId: { not: null } },
        select: { gmailThreadId: true },
      });
      const linkedSet = new Set(linked.map((l) => l.gmailThreadId!).filter(Boolean));
      threads = await listUnlinkedThreads(linkedSet, 25);
    } catch (e) {
      console.error('[resolution-inbox] list failed', e);
      error = t('resolution.inbox.gmailError');
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/staff/resolutions" className="text-sm text-gray-500 hover:underline">← {t('resolution.backToQueue')}</Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">📧 {t('resolution.inbox.title')}</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{t('resolution.inbox.subtitle', { label: resolutionLabel() })}</p>
      </div>

      {!configured ? (
        <div className="card p-5 text-sm text-gray-500 dark:text-slate-400">
          {t('resolution.inbox.notConfigured', { label: resolutionLabel() })}
        </div>
      ) : error ? (
        <div className="card p-5 text-sm text-red-600">{error}</div>
      ) : threads.length === 0 ? (
        <div className="card p-5 text-sm text-gray-500 dark:text-slate-400">{t('resolution.inbox.none')}</div>
      ) : (
        <>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{t('resolution.inbox.waiting', { n: threads.length })}</p>
          <ul className="space-y-2">
            {threads.map((th) => {
              // "New" = arrived in the last 24h, so this-morning's emails stand out
              // from the backlog (everything here is still unaddressed).
              const isNew = !!th.sentAt && Date.now() - th.sentAt.getTime() < 24 * 3_600_000;
              const dateLabel = th.sentAt
                ? th.sentAt.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : null;
              return (
                <li key={th.threadId} className={`card flex flex-wrap items-center justify-between gap-3 p-3 ${isNew ? 'ring-2 ring-emerald-400' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isNew && <span className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{t('resolution.inbox.new')}</span>}
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{decodeEntities(th.subject)}</span>
                    </div>
                    <div className="truncate text-xs text-gray-500 dark:text-slate-400">✉️ {th.fromAddr}</div>
                    {th.snippet && <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-slate-500">{decodeEntities(th.snippet)}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {dateLabel && (
                      <span className={`whitespace-nowrap text-sm font-bold tabular-nums ${isNew ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-slate-200'}`}>
                        {dateLabel}
                      </span>
                    )}
                    <Link
                      href={openAsCaseHref(th.threadId, th.subject)}
                      className="btn-secondary text-sm"
                    >
                      ＋ {t('resolution.inbox.openAsCase')}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
