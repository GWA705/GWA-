import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasDealerReportAccess } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { buildOfficeRangeReport } from '@/lib/reporting/officeRange';
import { OfficeRangeView } from '@/app/(staff)/staff/reports/OfficeRangeView';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

function monthOptions(count: number): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    });
  }
  return out;
}

/** Dealer "Overall sales" — the office-range "Total Sales" one-pager,
 * fixed to the dealer's own office. High-level, printable (OfficeRangeView) and
 * emailable. */
export default async function DealerOverallSalesPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await requireDealerAccess();
  if (!(await hasDealerReportAccess(user)) || !user.dealerId) notFound();

  const t = getT();
  const months = monthOptions(24);
  const valid = new Set(months.map((m) => m.value));
  const now = new Date();
  const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const janYm = `${now.getFullYear()}-01`; // year-to-date by default
  const to = searchParams.to && valid.has(searchParams.to) ? searchParams.to : thisYm;
  const from = searchParams.from && valid.has(searchParams.from) ? searchParams.from : janYm;

  return (
    <div className="space-y-5">
      <DealerReportTabs active="overall" />

      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="from">From</label>
            <select id="from" name="from" defaultValue={from} className="input min-w-[160px]">
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <select id="to" name="to" defaultValue={to} className="input min-w-[160px]">
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary">{t('reports.view')}</button>
        </form>
        <ReportActions title={t('reports.tabOverall')} showPrint={false} />
      </div>

      {!reportingJournalEnabled() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('reports.notReady')}</div>
      ) : (
        <OfficeRangeView report={await buildOfficeRangeReport(user.dealerId, from, to)} />
      )}
    </div>
  );
}
