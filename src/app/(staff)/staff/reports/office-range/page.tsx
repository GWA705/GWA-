import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { listReportOffices, ALL_OFFICES } from '@/lib/reporting/monthly';
import { buildOfficeRangeReport } from '@/lib/reporting/officeRange';
import { OfficeRangeView } from '../OfficeRangeView';
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

export default async function OfficeRangeReportPage({
  searchParams,
}: {
  searchParams: { office?: string; from?: string; to?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const t = getT();
  const offices = await listReportOffices();
  const months = monthOptions(24);
  const valid = new Set(months.map((m) => m.value));

  const now = new Date();
  const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const janYm = `${now.getFullYear()}-01`; // year-to-date by default

  const to = searchParams.to && valid.has(searchParams.to) ? searchParams.to : thisYm;
  const from = searchParams.from && valid.has(searchParams.from) ? searchParams.from : janYm;

  const officeChoices = [{ dealerId: ALL_OFFICES, name: 'All offices' }, ...offices];
  const officeId = officeChoices.some((o) => o.dealerId === searchParams.office)
    ? (searchParams.office as string)
    : ALL_OFFICES;

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        {t('staffReports.backAllReports')}
      </Link>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">{t('staffReports.office')}</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            {officeChoices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">From</label>
          <select id="from" name="from" defaultValue={from} className="input min-w-[160px]">
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="to">To</label>
          <select id="to" name="to" defaultValue={to} className="input min-w-[160px]">
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">{t('reports.view')}</button>
      </form>

      {!reportingJournalEnabled() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('staffReports.journalNotConnected1')}<code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2026</code>
          {t('staffReports.journalNotConnected2')}<code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2025</code>{t('staffReports.journalNotConnected3')}
        </div>
      ) : (
        <OfficeRangeView report={await buildOfficeRangeReport(officeId, from, to)} />
      )}
    </div>
  );
}
