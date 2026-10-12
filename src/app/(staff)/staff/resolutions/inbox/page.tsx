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
        <ul className="space-y-2">
          {threads.map((th) => (
            <li key={th.threadId} className="card flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{decodeEntities(th.subject)}</div>
                <div className="truncate text-xs text-gray-500 dark:text-slate-400">✉️ {th.fromAddr}{th.sentAt ? ` · ${th.sentAt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}` : ''}</div>
                {th.snippet && <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-slate-500">{decodeEntities(th.snippet)}</div>}
              </div>
              <Link
                href={openAsCaseHref(th.threadId, th.subject)}
                className="btn-secondary shrink-0 text-sm"
              >
                ＋ {t('resolution.inbox.openAsCase')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
