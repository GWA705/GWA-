import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { loadResolutionQueue, loadResolutionStats } from '@/lib/resolutionCases';
import { ResolutionStatsHeader } from './ResolutionStatsHeader';
import { RESOLUTION_STATUSES, STATUS_LABEL, statusChipClass } from '@/lib/resolutionStatus';
import { gmailResolutionConfigured } from '@/lib/gmailResolution';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const AGE_ROW: Record<string, string> = {
  red: 'bg-red-50/60 dark:bg-red-900/20',
  amber: 'bg-amber-50/60 dark:bg-amber-900/20',
  none: '',
};

export default async function ResolutionQueuePage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  await requireRole('REVIEWER', 'ADMIN');
  const t = getT();
  const [queue, stats] = await Promise.all([
    loadResolutionQueue({ status: searchParams.status, q: searchParams.q }),
    loadResolutionStats(),
  ]);
  const active = queue.status;

  // Count chips (click to filter). "Live" = the default open-only view.
  const liveCount = (['OPEN', 'IN_PROGRESS', 'WAITING_ON_OFFICE', 'ESCALATED_HD'] as const).reduce((s, k) => s + queue.counts[k], 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">🧰 {t('resolution.queue.title')}</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{t('resolution.queue.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {gmailResolutionConfigured() && (
            <Link href="/staff/resolutions/inbox" className="btn-secondary">📧 {t('resolution.queue.emailInbox')}</Link>
          )}
          <Link href="/staff/resolutions/new" className="btn-primary">＋ {t('resolution.queue.newCase')}</Link>
        </div>
      </div>

      {/* At-a-glance overview */}
      <ResolutionStatsHeader stats={stats} />

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip href="/staff/resolutions" label={`${t('resolution.queue.live')} · ${liveCount}`} active={!active} />
        {RESOLUTION_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/staff/resolutions?status=${s}`}
            label={`${STATUS_LABEL[s]} · ${queue.counts[s]}`}
            active={active === s}
          />
        ))}
        <FilterChip href="/staff/resolutions?status=all" label={t('common.all')} active={active === 'all'} />
      </div>

      {/* Search */}
      <form method="GET" className="flex flex-wrap items-end gap-2">
        {active && <input type="hidden" name="status" value={active} />}
        <input name="q" defaultValue={queue.q} placeholder={t('resolution.queue.searchPlaceholder')} className="input min-w-[220px]" />
        <button type="submit" className="btn-secondary">{t('common.search')}</button>
      </form>

      {/* Queue table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{t('resolution.queue.colCase')}</th>
                <th className="px-4 py-3">{t('resolution.queue.colCustomer')}</th>
                <th className="px-4 py-3">{t('resolution.queue.colOffice')}</th>
                <th className="px-4 py-3">{t('resolution.queue.colStatus')}</th>
                <th className="px-4 py-3">{t('resolution.queue.colOpened')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {queue.rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">{queue.q || active ? t('resolution.queue.noCasesFiltered') : t('resolution.queue.noCasesYet')}</td></tr>
              ) : (
                queue.rows.map((r) => (
                  <tr key={r.id} className={AGE_ROW[r.age]}>
                    <td className="px-4 py-3">
                      <Link href={`/staff/resolutions/${r.id}`} className="font-semibold text-brand-700 hover:underline dark:text-sky-300">{r.caseNumber}</Link>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{r.title}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-slate-200">{r.customerName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{r.officeName}</td>
                    <td className="px-4 py-3">
                      <span className={statusChipClass(r.status)}>{STATUS_LABEL[r.status]}</span>
                      {r.age === 'red' && <span className="ml-2 text-xs font-semibold text-red-600">● {t('resolution.queue.aging')}</span>}
                      {r.age === 'amber' && <span className="ml-2 text-xs font-semibold text-amber-600">● {t('resolution.queue.ageing')}</span>}
                      {r.awaitingReplyDays != null && (
                        <div className={`mt-1 text-xs font-semibold ${r.awaitingReplyDays >= 5 ? 'text-red-600' : 'text-amber-600'}`}>
                          ⏳ {t('resolution.queue.awaitingReply')} · {r.awaitingReplyDays}d
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{r.openedDay}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300'
      }`}
    >
      {label}
    </Link>
  );
}
