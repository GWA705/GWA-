import { requireAdminSection } from '@/lib/session';
import { LeadsSelect } from '@/components/LeadsSelect';
import { mailInLeadsReport, monthWindow, recentMonthKeys } from '@/lib/reporting/mailInLeads';

export const dynamic = 'force-dynamic';

const nf = (n: number) => n.toLocaleString('en-CA');

function Tile({ label, value, tone = 'text-gray-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{nf(value)}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

export default async function MailInBillingPage({ searchParams }: { searchParams: { month?: string } }) {
  await requireAdminSection('mail-in-billing');

  const months = recentMonthKeys(12);
  // Default to the current month; '' / 'all' means all-time.
  const monthParam = searchParams.month ?? months[0].value;
  const { from, to } = monthWindow(monthParam);
  const report = await mailInLeadsReport({ from, to });

  const periodLabel =
    !monthParam || monthParam === 'all'
      ? 'All time'
      : months.find((m) => m.value === monthParam)?.label ?? monthParam;

  const billableRows = report.rows.filter((r) => r.billable > 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Mail-in billing</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Scanned <strong>HD Mail In Test</strong> leads, split by who uploaded them. <strong>Billable</strong> = leads
            <strong> Georgian Water</strong> uploaded (mailed to our office). Leads an office scanned itself are not billed.
          </p>
        </div>
        <LeadsSelect
          paramName="month"
          value={monthParam === 'all' ? '' : monthParam}
          options={months}
          allLabel="All time"
          ariaLabel="Billing period"
          basePath="/admin/mail-in-billing"
          params={[]}
        />
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Billable (GW uploaded)" value={report.totals.billable} tone="text-emerald-600" />
        <Tile label="Office uploaded (not billed)" value={report.totals.officeUploaded} tone="text-gray-500" />
        <Tile label="Total mail-in leads" value={report.totals.total} />
      </div>

      {/* Report A — Billable */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Billable to offices — {periodLabel}</h2>
          <p className="mt-0.5 text-xs text-gray-500">Leads Georgian Water uploaded, by office. This is what gets billed.</p>
        </div>
        {billableRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">No billable mail-in leads for {periodLabel.toLowerCase()}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="py-2 pl-5 pr-2 font-medium">Office</th>
                <th className="py-2 px-5 text-right font-medium">Billable leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {billableRows.map((r) => (
                <tr key={r.dealerId ?? 'unassigned'}>
                  <td className="py-2.5 pl-5 pr-2 font-medium text-gray-900">{r.officeName}</td>
                  <td className="py-2.5 px-5 text-right font-bold tabular-nums text-emerald-700">{nf(r.billable)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="py-2.5 pl-5 pr-2 text-gray-900">Total billable</td>
                <td className="py-2.5 px-5 text-right tabular-nums text-emerald-700">{nf(report.totals.billable)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {/* Report B — all mail-in by office */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">All mail-in leads by office — {periodLabel}</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Every mail-in lead per office, including the ones Georgian Water uploaded. Office-uploaded leads are shown for
            visibility but aren&rsquo;t billed.
          </p>
        </div>
        {report.rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">No mail-in leads for {periodLabel.toLowerCase()}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="py-2 pl-5 pr-2 font-medium">Office</th>
                  <th className="py-2 px-2 text-right font-medium">Billable (GW)</th>
                  <th className="py-2 px-2 text-right font-medium">Office uploaded</th>
                  <th className="py-2 px-5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.rows.map((r) => (
                  <tr key={r.dealerId ?? 'unassigned'}>
                    <td className="py-2.5 pl-5 pr-2 font-medium text-gray-900">{r.officeName}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-emerald-700">{nf(r.billable)}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-gray-500">{nf(r.officeUploaded)}</td>
                    <td className="py-2.5 px-5 text-right font-semibold tabular-nums text-gray-900">{nf(r.total)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-2.5 pl-5 pr-2 text-gray-900">Total</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-emerald-700">{nf(report.totals.billable)}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-gray-500">{nf(report.totals.officeUploaded)}</td>
                  <td className="py-2.5 px-5 text-right tabular-nums text-gray-900">{nf(report.totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] text-gray-400">
        Billing starts counting from when the &ldquo;uploaded by&rdquo; flag shipped — leads scanned before then show as
        office-uploaded. A per-lead billing rate can be added here when you&rsquo;re ready to invoice.
      </p>
    </div>
  );
}
