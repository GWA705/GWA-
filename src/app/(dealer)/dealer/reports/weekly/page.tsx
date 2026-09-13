import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasDealerReportAccess, canViewOwnerPricingReport } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { buildStoreWeekReport } from '@/lib/reporting/storeWeek';
import { StoreWeekView } from '@/app/(staff)/staff/reports/StoreWeekView';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
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

export default async function DealerWeeklyReportPage({ searchParams }: { searchParams: { weeks?: string } }) {
  const user = await requireDealerAccess();
  if (!(await hasDealerReportAccess(user)) || !user.dealerId) notFound();

  const t = getT();
  const intlLocale = getLocale() === 'fr' ? 'fr-CA' : 'en-US';
  const weeks = weekOptions(12, t, intlLocale);
  const weeksOffset = Math.min(0, parseInt(searchParams.weeks ?? '-1', 10) || -1);
  const asOf = new Date();
  asOf.setDate(asOf.getDate() + weeksOffset * 7);

  const showOwner = await canViewOwnerPricingReport(user);
  const brand = await getDealerReportBrand(user.dealerId);

  return (
    <div className="space-y-5">
      <DealerReportTabs active="weekly" showOwner={showOwner} />

      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-3">
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
        <ReportActions title={t('reports.tabWeekly')} />
      </div>

      {!reportingJournalEnabled() ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
          {t('reports.notReady')}
          <Link href="/dealer/support" className="text-sky-600 hover:underline">
            {t('reports.contactLink')}
          </Link>
          {t('reports.notReadyAfter')}
        </div>
      ) : (
        <div className="print-sheet space-y-5">
          <StoreWeekView report={await buildStoreWeekReport(user.dealerId, asOf)} showLinks={false} org={brand.name} orgLogoUrl={brand.logoUrl} />
        </div>
      )}
    </div>
  );
}
