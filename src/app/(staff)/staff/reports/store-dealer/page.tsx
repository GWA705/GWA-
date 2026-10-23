import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReport } from '@/lib/reporting/visibility';
import { canViewDealerSnapshot } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { buildStoreDealerReport } from '@/lib/reporting/storeDealer';
import { StoreDealerView } from '../StoreDealerView';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function StoreDealerReportPage({
  searchParams,
}: {
  searchParams: { mode?: string; store?: string; dealer?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  // Cross-dealer per-store data — same gate as the Dealer Snapshot.
  if (!(await canViewReport(user, 'staffDealerSnapshot')) && !(await canViewDealerSnapshot(user))) {
    notFound();
  }

  const t = getT();
  const mode: 'store' | 'dealer' = searchParams.mode === 'dealer' ? 'dealer' : 'store';
  const selected = mode === 'store' ? searchParams.store ?? null : searchParams.dealer ?? null;

  const connected = reportingJournalEnabled();
  const report = connected ? await buildStoreDealerReport(mode, selected) : null;

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        {t('staffReports.backAllReports')}
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Store ↔ Dealer</h1>
        <p className="mt-1 text-sm text-gray-600">
          Cross-reference Home Depot stores against the offices that sold at them. View by store to see every office
          that worked a store (and when), or by office to see every store it sold at. Read from the sales journals,
          attributed by the journal’s Dealer column.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="mode">View</label>
          <select id="mode" name="mode" defaultValue={mode} className="input min-w-[180px]">
            <option value="store">By store → offices</option>
            <option value="dealer">By office → stores</option>
          </select>
        </div>

        {mode === 'store' ? (
          <div>
            <label className="label" htmlFor="store">Store</label>
            <select id="store" name="store" defaultValue={selected ?? ''} className="input min-w-[240px]">
              <option value="">All stores (handover overview)</option>
              {(report?.stores ?? []).map((s) => (
                <option key={s.number} value={s.number}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="dealer">Office</label>
            <select id="dealer" name="dealer" defaultValue={selected ?? ''} className="input min-w-[240px]">
              <option value="">— Select an office —</option>
              {(report?.dealers ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.archived ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <button type="submit" className="btn-primary">{t('reports.view')}</button>
      </form>

      {!connected ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('staffReports.journalNotConnectedShort')}
        </div>
      ) : (
        report && <StoreDealerView report={report} />
      )}
    </div>
  );
}
