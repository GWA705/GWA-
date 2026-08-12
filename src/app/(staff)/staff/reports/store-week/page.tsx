import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { listReportOffices } from '@/lib/reporting/monthly';
import { buildStoreWeekReport } from '@/lib/reporting/storeWeek';
import { StoreWeekView } from '../StoreWeekView';

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

export default async function StoreWeekPage({
  searchParams,
}: {
  searchParams: { office?: string; weeks?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const offices = await listReportOffices();
  const weeks = weekOptions(12);
  const weeksOffset = Math.min(0, parseInt(searchParams.weeks ?? '-1', 10) || -1);
  const officeId = offices.some((o) => o.dealerId === searchParams.office)
    ? (searchParams.office as string)
    : offices[0]?.dealerId;

  const asOf = new Date();
  asOf.setDate(asOf.getDate() + weeksOffset * 7);

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        ← All reports
      </Link>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">Office</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            {offices.length === 0 && <option value="">No offices with HD stores</option>}
            {offices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          The sales journals aren&apos;t connected yet. Set <code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2026</code>{' '}
          and <code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2025</code> on the server to enable reports.
        </div>
      ) : !officeId ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No offices have Home Depot store numbers assigned. Add them under Admin → Dealers.
        </div>
      ) : (
        <StoreWeekView report={await buildStoreWeekReport(officeId, asOf)} />
      )}
    </div>
  );
}
