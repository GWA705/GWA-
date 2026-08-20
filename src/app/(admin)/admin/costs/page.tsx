import { requireAdminSection } from '@/lib/session';
import { getCostConfig, computeMonthlyCosts } from '@/lib/costs';
import { placesConfigured } from '@/lib/googlePlaces';
import { CostsForm } from './CostsForm';

export const dynamic = 'force-dynamic';

const money = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function CostsPage() {
  await requireAdminSection('costs');
  const cfg = await getCostConfig();
  const breakdown = await computeMonthlyCosts(cfg);
  const googleLive = placesConfigured();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Outside costs</h1>
        <p className="mt-1 text-sm text-gray-500">
          What the portal costs to run each month across outside services — the Google address-lookup API
          (counted automatically) plus your fixed hosting bills.
        </p>
      </div>

      {/* Headline total */}
      <div className="card bg-brand-600 p-6 text-white">
        <p className="text-sm font-medium text-brand-100">Estimated total — {monthLabel(breakdown.month)}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">{money(breakdown.total)}</p>
        <p className="mt-2 text-xs text-brand-100">
          Google usage is real (counted so far this month); the fixed bills are the amounts you enter below.
        </p>
      </div>

      {/* Breakdown */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">This month, line by line</h2>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {breakdown.lines.map((l) => (
              <tr key={l.label}>
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900">{l.label}</div>
                  <div className="text-xs text-gray-500">{l.detail}</div>
                </td>
                <td className="px-5 py-3 text-right">
                  {l.usageBased && (
                    <span className="mr-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                      metered
                    </span>
                  )}
                  <span className="font-semibold tabular-nums text-gray-900">{money(l.amount)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="px-5 py-3 font-semibold text-gray-900">Total</td>
              <td className="px-5 py-3 text-right text-lg font-bold tabular-nums text-gray-900">
                {money(breakdown.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Google usage detail */}
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">Google address lookups</h2>
          <span
            className={`badge ${googleLive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
          >
            {googleLive ? 'Connected' : 'Not configured'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {breakdown.google.autocompleteCalls.toLocaleString('en-CA')}
            </div>
            <div className="text-xs text-gray-500">Autocomplete calls</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-2xl font-bold tabular-nums text-gray-900">
              {breakdown.google.detailsCalls.toLocaleString('en-CA')}
            </div>
            <div className="text-xs text-gray-500">Details calls</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-2xl font-bold tabular-nums text-gray-900">{money(breakdown.google.netCost)}</div>
            <div className="text-xs text-gray-500">Google cost this month</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Counts every address lookup the portal has made this month. Use these numbers to check against your real
          Google Cloud bill; adjust the per-1,000 rates below if Google&apos;s pricing changes.
        </p>
      </div>

      {/* Editable settings */}
      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Rates &amp; fixed bills</h2>
        <p className="mb-4 text-sm text-gray-500">
          The fixed amounts are starting estimates — replace them with your actual monthly bills. Changes take effect
          immediately (no redeploy).
        </p>
        <CostsForm cfg={cfg} />
      </div>
    </div>
  );
}
