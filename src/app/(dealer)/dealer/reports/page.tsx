import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasDealerReportAccess, canViewOwnerPricingReport } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { buildOfficeMonthlyReport } from '@/lib/reporting/monthly';
import { MonthlyReportView } from '@/app/(staff)/staff/reports/MonthlyReportView';
import { DealerReportTabs } from './DealerReportTabs';
import { ReportActions } from './ReportActions';
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

export default async function DealerReportsPage({ searchParams }: { searchParams: { ym?: string } }) {
  const user = await requireDealerAccess();
  if (!(await hasDealerReportAccess(user)) || !user.dealerId) notFound();

  const months = monthOptions(18);
  const now = new Date();
  const defPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defYm = `${defPrev.getFullYear()}-${String(defPrev.getMonth() + 1).padStart(2, '0')}`;
  const ym = months.some((m) => m.value === searchParams.ym) ? (searchParams.ym as string) : defYm;
  const [yStr, mStr] = ym.split('-');
  const year = parseInt(yStr, 10);
  const monthIndex = parseInt(mStr, 10) - 1;
  const showOwner = await canViewOwnerPricingReport(user);
  const t = getT();

  return (
    <div className="space-y-5">
      <DealerReportTabs active="monthly" showOwner={showOwner} />

      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="ym">{t('reports.month')}</label>
            <select id="ym" name="ym" defaultValue={ym} className="input min-w-[180px]">
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            {t('reports.view')}
          </button>
        </form>
        <ReportActions title={t('reports.tabMonthly')} />
      </div>

      {!reportingJournalEnabled() ? (
        <NotReady />
      ) : (
        <div className="print-sheet space-y-5">
          <MonthlyReportView report={await buildOfficeMonthlyReport(user.dealerId, year, monthIndex)} />
        </div>
      )}
    </div>
  );
}

function NotReady() {
  const t = getT();
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
      {t('reports.notReady')}
      <Link href="/dealer/support" className="text-sky-600 hover:underline">{t('reports.contactLink')}</Link>
      {t('reports.notReadyAfter')}
    </div>
  );
}
