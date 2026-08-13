import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { isSuperAdmin, canAdminSection } from '@/lib/rbac';
import { readLeads, summarize } from '@/lib/leads';
import { leadsSheetId, reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { listReportOffices } from '@/lib/reporting/monthly';
import { LeadsView, filterLeads } from '@/components/LeadsView';

export const dynamic = 'force-dynamic';

export default async function StaffLeadsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; office?: string; page?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  // All-offices leads = leadership view: super admin or a granted 'leads' section.
  if (!isSuperAdmin(user) && !canAdminSection(user, 'leads')) notFound();

  const q = (searchParams.q ?? '').trim();
  const status = (searchParams.status ?? '').trim();
  const officeId = (searchParams.office ?? '').trim();
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);

  if (!leadsSheetId() || !reportingJournalEnabled()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          The HD leads log isn&apos;t connected yet. Set <code className="rounded bg-amber-100 px-1">HD_LEADS_SHEET_ID</code> and
          share the sheet with the service account (see Admin → System health).
        </div>
      </div>
    );
  }

  const [read, offices] = await Promise.all([readLeads(), listReportOffices()]);
  const office = offices.find((o) => o.dealerId === officeId) || null;

  // Scope by the selected office's store numbers (or all offices when none picked).
  let scoped = read.leads;
  if (office) {
    const set = new Set(office.storeNumbers);
    scoped = scoped.filter((l) => set.has(l.storeNumber));
  }
  const summary = summarize(scoped);
  const filtered = filterLeads(scoped, q, status);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-600">Home Depot leads across all offices, from the leads log.</p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">Office</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            <option value="">All offices</option>
            {offices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
            ))}
          </select>
        </div>
        {q && <input type="hidden" name="q" value={q} />}
        {status && <input type="hidden" name="status" value={status} />}
        <button type="submit" className="btn-primary">View</button>
      </form>

      {read.error && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t read the leads log right now: {read.error}
        </div>
      )}

      <LeadsView
        leads={filtered}
        summary={summary}
        q={q}
        status={status}
        basePath="/staff/leads"
        extraHidden={[{ name: 'office', value: officeId }]}
        page={page}
      />
    </div>
  );
}
