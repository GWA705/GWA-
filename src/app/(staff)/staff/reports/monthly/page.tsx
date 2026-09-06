import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { listReportOffices, buildOfficeMonthlyReport } from '@/lib/reporting/monthly';
import { MonthlyReportView } from '../MonthlyReportView';
import { getT, getLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

function monthOptions(count: number, intlLocale: string): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString(intlLocale, { month: 'long', year: 'numeric' }),
    });
  }
  return out;
}

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: { office?: string; ym?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const t = getT();
  const intlLocale = getLocale() === 'fr' ? 'fr-CA' : 'en-US';
  const offices = await listReportOffices();
  const months = monthOptions(18, intlLocale);

  // Defaults: previous complete month, first office with stores.
  const now = new Date();
  const defPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defYm = `${defPrev.getFullYear()}-${String(defPrev.getMonth() + 1).padStart(2, '0')}`;
  const ym = months.some((m) => m.value === searchParams.ym) ? (searchParams.ym as string) : defYm;
  const [yStr, mStr] = ym.split('-');
  const year = parseInt(yStr, 10);
  const monthIndex = parseInt(mStr, 10) - 1;

  const officeId = offices.some((o) => o.dealerId === searchParams.office)
    ? (searchParams.office as string)
    : offices[0]?.dealerId;

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        {t('staffReports.backAllReports')}
      </Link>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">{t('staffReports.office')}</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            {offices.length === 0 && <option value="">{t('staffReports.noOfficesWithStores')}</option>}
            {offices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ym">{t('reports.month')}</label>
          <select id="ym" name="ym" defaultValue={ym} className="input min-w-[160px]">
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

      {!reportingJournalEnabled() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('staffReports.journalNotConnected1')}<code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2026</code>
          {t('staffReports.journalNotConnected2')}<code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2025</code>{t('staffReports.journalNotConnected3')}
        </div>
      ) : !officeId ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          {t('staffReports.noOfficeStoresAssigned')}
        </div>
      ) : (
        <MonthlyReportView report={await buildOfficeMonthlyReport(officeId, year, monthIndex)} />
      )}
    </div>
  );
}
