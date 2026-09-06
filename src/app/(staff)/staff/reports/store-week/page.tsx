import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { listReportOffices } from '@/lib/reporting/monthly';
import { buildStoreWeekReport } from '@/lib/reporting/storeWeek';
import { StoreWeekView } from '../StoreWeekView';
import { getT, getLocale } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';

export const dynamic = 'force-dynamic';

function weekOptions(count: number, t: TFunction, intlLocale: string): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (x: Date) => x.toLocaleString(intlLocale, { month: 'short', day: 'numeric' });
    const range = `${fmt(monday)}–${fmt(sunday)}`;
    out.push({ value: String(-i), label: i === 0 ? t('reports.thisWeek', { range }) : `${fmt(monday)} – ${fmt(sunday)}` });
  }
  return out;
}

export default async function StoreWeekPage({
  searchParams,
}: {
  searchParams: { office?: string; weeks?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const t = getT();
  const intlLocale = getLocale() === 'fr' ? 'fr-CA' : 'en-US';
  const offices = await listReportOffices();
  const weeks = weekOptions(12, t, intlLocale);
  const weeksOffset = Math.min(0, parseInt(searchParams.weeks ?? '-1', 10) || -1);
  const officeId = offices.some((o) => o.dealerId === searchParams.office)
    ? (searchParams.office as string)
    : offices[0]?.dealerId;

  const asOf = new Date();
  asOf.setDate(asOf.getDate() + weeksOffset * 7);

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
          <label className="label" htmlFor="weeks">{t('reports.week')}</label>
          <select id="weeks" name="weeks" defaultValue={String(weeksOffset)} className="input min-w-[200px]">
            {weeks.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
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
        <StoreWeekView report={await buildStoreWeekReport(officeId, asOf)} />
      )}
    </div>
  );
}
