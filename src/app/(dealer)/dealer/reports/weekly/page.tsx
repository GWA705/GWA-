import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasDealerReportAccess, canViewOwnerPricingReport } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { buildStoreWeekReport } from '@/lib/reporting/storeWeek';
import { StoreWeekView } from '@/app/(staff)/staff/reports/StoreWeekView';
import { DealerReportTabs } from '../DealerReportTabs';

export const dynamic = 'force-dynamic';

function weekOptions(count: number): { value: string; label: string }[] {
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
    const fmt = (x: Date) => x.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    out.push({ value: String(-i), label: i === 0 ? `This week (${fmt(monday)}–${fmt(sunday)})` : `${fmt(monday)} – ${fmt(sunday)}` });
  }
  return out;
}

export default async function DealerWeeklyReportPage({ searchParams }: { searchParams: { weeks?: string } }) {
  const user = await requireDealerAccess();
  if (!(await hasDealerReportAccess(user)) || !user.dealerId) notFound();

  const weeks = weekOptions(12);
  const weeksOffset = Math.min(0, parseInt(searchParams.weeks ?? '-1', 10) || -1);
  const asOf = new Date();
  asOf.setDate(asOf.getDate() + weeksOffset * 7);

  const showPricing = await canViewOwnerPricingReport(user);

  return (
    <div className="space-y-5">
      <DealerReportTabs active="weekly" showPricing={showPricing} />

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="weeks">Week</label>
          <select id="weeks" name="weeks" defaultValue={String(weeksOffset)} className="input min-w-[200px]">
            {weeks.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          View
        </button>
      </form>

      {!reportingJournalEnabled() ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
          Your reports aren&apos;t available yet. Please check back soon or{' '}
          <Link href="/dealer/support" className="text-sky-600 hover:underline">
            contact GWA
          </Link>
          .
        </div>
      ) : (
        <StoreWeekView report={await buildStoreWeekReport(user.dealerId, asOf)} showLinks={false} />
      )}
    </div>
  );
}
