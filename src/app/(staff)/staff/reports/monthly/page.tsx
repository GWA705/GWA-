import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { listReportOffices, buildOfficeMonthlyReport } from '@/lib/reporting/monthly';
import { MonthlyReportView } from '../MonthlyReportView';

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

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: { office?: string; ym?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const offices = await listReportOffices();
  const months = monthOptions(18);

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
          <label className="label" htmlFor="ym">Month</label>
          <select id="ym" name="ym" defaultValue={ym} className="input min-w-[160px]">
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
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
          No offices have Home Depot store numbers assigned. Add them under Admin → Dealers so sales can be attributed.
        </div>
      ) : (
        <MonthlyReportView report={await buildOfficeMonthlyReport(officeId, year, monthIndex)} />
      )}
    </div>
  );
}
