import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { gmailResolutionConfigured, listUnlinkedThreads, resolutionLabel, parseHdCaseNumber, type GmailThreadSummary } from '@/lib/gmailResolution';

export const dynamic = 'force-dynamic';

export default async function ResolutionInboxPage() {
  await requireRole('REVIEWER', 'ADMIN');

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
      error = 'Couldn’t reach Gmail. Check the email setup and try again.';
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/staff/resolutions" className="text-sm text-gray-500 hover:underline">← Back to the queue</Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">📧 Unlinked HD emails</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">Recent emails under the &quot;{resolutionLabel()}&quot; label not yet linked to a case. Turn one into a case in a click.</p>
      </div>

      {!configured ? (
        <div className="card p-5 text-sm text-gray-500 dark:text-slate-400">
          The Gmail email link isn&apos;t set up yet. Once read-only access and the &quot;{resolutionLabel()}&quot; label are configured, HD emails will appear here.
        </div>
      ) : error ? (
        <div className="card p-5 text-sm text-red-600">{error}</div>
      ) : threads.length === 0 ? (
        <div className="card p-5 text-sm text-gray-500 dark:text-slate-400">No unlinked HD emails right now.</div>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.threadId} className="card flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{t.subject}</div>
                <div className="truncate text-xs text-gray-500 dark:text-slate-400">✉️ {t.fromAddr}{t.sentAt ? ` · ${t.sentAt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}` : ''}</div>
                {t.snippet && <div className="mt-0.5 truncate text-xs text-gray-400 dark:text-slate-500">{t.snippet}</div>}
              </div>
              <Link
                href={`/staff/resolutions/new?gmailThreadId=${encodeURIComponent(t.threadId)}&title=${encodeURIComponent(t.subject)}${parseHdCaseNumber(t.subject) ? `&hdCase=${encodeURIComponent(parseHdCaseNumber(t.subject)!)}` : ''}`}
                className="btn-secondary shrink-0 text-sm"
              >
                ＋ Open as case
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
