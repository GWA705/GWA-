import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import {
  gmailResolutionConfigured,
  listUnlinkedThreads,
  resolutionLabel,
  parseHdSubject,
  parseHdCaseNumber,
  type GmailThreadSummary,
} from '@/lib/gmailResolution';
import { decodeEntities } from '@/lib/htmlEntities';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

// Build the "Open as case" link, pre-filling everything we can parse from the
// email subject: the thread link, title, HD Case #, HD Ref #, and customer name.
function openAsCaseHref(threadId: string, subject: string): string {
  const p = parseHdSubject(subject);
  const params = new URLSearchParams({ gmailThreadId: threadId, title: decodeEntities(subject) });
  if (p.caseNumber) params.set('hdCase', p.caseNumber);
  if (p.hdRef) params.set('hdRef', p.hdRef);
  if (p.lastName) params.set('name', p.lastName);
  return `/staff/resolutions/new?${params.toString()}`;
}

// Short "how long it's been waiting" label (e.g. 3h, 2d) from an age in ms.
function agoLabel(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

type Bucket = 'new' | 'amber' | 'red' | 'none';
// Age colour: new (<24h) green, aging (≥5d) amber, old (≥10d) red.
function bucketFor(ageDays: number | null, isNew: boolean): Bucket {
  if (isNew) return 'new';
  if (ageDays == null) return 'none';
  if (ageDays >= 10) return 'red';
  if (ageDays >= 5) return 'amber';
  return 'none';
}

const ACCENT: Record<Bucket, string> = {
  new: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  none: 'bg-gray-200 dark:bg-slate-700',
};

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

  const now = Date.now();
  const items = threads.map((th) => {
    const ageMs = th.sentAt ? now - th.sentAt.getTime() : null;
    const ageDays = ageMs != null ? ageMs / 86_400_000 : null;
    const isNew = ageMs != null && ageMs < 24 * 3_600_000;
    const parts = parseHdSubject(th.subject);
    return {
      th,
      isNew,
      ageMs,
      bucket: bucketFor(ageDays, isNew),
      caseNo: parseHdCaseNumber(th.subject),
      name: parts.lastName,
      store: parts.store,
      dateLabel: th.sentAt
        ? th.sentAt.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : null,
      ago: ageMs != null ? agoLabel(ageMs) : null,
    };
  });

  const total = items.length;
  const newCount = items.filter((i) => i.isNew).length;
  const oldest = items.reduce((max, i) => (i.ageMs != null && i.ageMs > max ? i.ageMs : max), 0);

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/staff/resolutions" className="text-sm text-gray-500 hover:underline dark:text-slate-400">← {t('resolution.backToQueue')}</Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">📧 {t('resolution.inbox.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-slate-400">{t('resolution.inbox.subtitle', { label: resolutionLabel() })}</p>
        </div>
      </div>

      {!configured ? (
        <div className="card p-5 text-sm text-gray-500 dark:text-slate-400">
          {t('resolution.inbox.notConfigured', { label: resolutionLabel() })}
        </div>
      ) : error ? (
        <div className="card p-5 text-sm text-red-600">{error}</div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('resolution.inbox.statWaiting')} value={String(total)} tone="brand" />
            <Stat label={t('resolution.inbox.statNew')} value={String(newCount)} tone={newCount > 0 ? 'green' : 'muted'} />
            <Stat label={t('resolution.inbox.statOldest')} value={oldest > 0 ? agoLabel(oldest) : '—'} tone={oldest >= 10 * 86_400_000 ? 'red' : oldest >= 5 * 86_400_000 ? 'amber' : 'muted'} />
          </div>

          {total === 0 ? (
            <div className="card flex flex-col items-center gap-1 p-10 text-center">
              <span className="text-3xl">✅</span>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{t('resolution.inbox.noneTitle')}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400">{t('resolution.inbox.noneBody')}</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map(({ th, isNew, bucket, caseNo, name, store, dateLabel, ago }) => (
                <li key={th.threadId} className="card flex overflow-hidden p-0">
                  {/* Age accent bar */}
                  <div className={`w-1.5 flex-none ${ACCENT[bucket]}`} aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      {/* Case # + New badge */}
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {caseNo && (
                          <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold tracking-wide text-brand-700 dark:bg-slate-700 dark:text-sky-300">
                            {t('resolution.inbox.caseLabel')} #{caseNo}
                          </span>
                        )}
                        {name && <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{decodeEntities(name)}</span>}
                        {store && <span className="text-xs text-gray-400 dark:text-slate-500">· {t('resolution.inbox.store')} {store}</span>}
                        {isNew && (
                          <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{t('resolution.inbox.new')}</span>
                        )}
                      </div>
                      {/* Subject */}
                      <div className="truncate text-sm text-gray-700 dark:text-slate-300">{decodeEntities(th.subject)}</div>
                      {/* From + snippet */}
                      <div className="mt-1 truncate text-xs text-gray-400 dark:text-slate-500">
                        {t('resolution.inbox.from')} {th.fromAddr}
                      </div>
                      {th.snippet && <div className="mt-0.5 line-clamp-2 text-xs text-gray-400 dark:text-slate-500">{decodeEntities(th.snippet)}</div>}
                    </div>

                    {/* Right: date + age + action */}
                    <div className="flex flex-none flex-col items-end gap-2">
                      {dateLabel && (
                        <div className="text-right">
                          <div className={`whitespace-nowrap text-sm font-bold tabular-nums ${isNew ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-800 dark:text-slate-200'}`}>{dateLabel}</div>
                          {ago && (
                            <div className={`text-xs font-medium tabular-nums ${bucket === 'red' ? 'text-red-600' : bucket === 'amber' ? 'text-amber-600' : 'text-gray-400 dark:text-slate-500'}`}>
                              {ago} {bucket === 'red' || bucket === 'amber' ? `· ${t('resolution.inbox.aging')}` : ''}
                            </div>
                          )}
                        </div>
                      )}
                      <Link href={openAsCaseHref(th.threadId, th.subject)} className="btn-primary whitespace-nowrap text-sm">
                        ＋ {t('resolution.inbox.openAsCase')}
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'brand' | 'green' | 'amber' | 'red' | 'muted' }) {
  const toneCls: Record<string, string> = {
    brand: 'text-brand-700 dark:text-sky-300',
    green: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    muted: 'text-gray-400 dark:text-slate-500',
  };
  return (
    <div className="card p-4">
      <div className={`text-2xl font-bold tabular-nums ${toneCls[tone]}`}>{value}</div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
