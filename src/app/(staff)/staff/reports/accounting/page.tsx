import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import { requireRole } from '@/lib/session';
import { isAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { listReportOffices, ALL_OFFICES } from '@/lib/reporting/monthly';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';

export const dynamic = 'force-dynamic';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

/**
 * Admin-side Accounting export — the owner CSV payout export, for any office (or
 * all offices). Posts to the shared export endpoint with ?dealerId=…; the
 * endpoint admin-gates and scopes the download. Internal admins only.
 */
export default async function StaffAccountingPage({ searchParams }: { searchParams: { office?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isAdmin(user) || !(await canViewReportsArea(user))) notFound();

  const offices = await listReportOffices();
  const choices = [{ dealerId: ALL_OFFICES, name: 'All offices' }, ...offices];
  const officeId = choices.some((o) => o.dealerId === searchParams.office) ? (searchParams.office as string) : ALL_OFFICES;
  const officeName = choices.find((o) => o.dealerId === officeId)?.name ?? 'All offices';

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← All reports</Link>

      {/* Office selector (reloads the page so the download targets this office) */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">Office</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            {choices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary h-10">Choose</button>
      </form>

      <ReportHeader org={officeName} title="Accounting export" generated={`Generated ${reportGeneratedLabel()}`} />

      <section className="card p-6">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <FileSpreadsheet size={22} />
          </span>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Payout CSV — {officeName}</h2>
            <p className="text-sm text-gray-500">
              One row per deal with the full EFT payout breakdown, for an accounting team to reconcile. Pick a date
              range and download.
            </p>
          </div>
        </div>

        <form action="/api/dealer/accounting-export" method="get" className="flex flex-wrap items-end gap-3">
          {officeId !== ALL_OFFICES && <input type="hidden" name="dealerId" value={officeId} />}
          <div>
            <label className="label" htmlFor="from">From</label>
            <input type="date" id="from" name="from" defaultValue={firstOfMonth()} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="to">To</label>
            <input type="date" id="to" name="to" defaultValue={today()} className="input" />
          </div>
          <button type="submit" className="btn-primary h-10">Download CSV</button>
        </form>
      </section>

      <ReportStamp brand="Georgian Water & Air" generated={`Generated ${reportGeneratedLabel()}`} />
    </div>
  );
}
