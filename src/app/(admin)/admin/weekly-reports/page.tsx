import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { emailEnabled } from '@/lib/email';
import { lastFullWeek, assembleStoreReports, weeklyReportsEnabled } from '@/lib/reporting/weeklyReports';
import { MasterSwitch, TestNationalButton, TestStoreButton, SendNowButton } from './WeeklyReportsButtons';

export const dynamic = 'force-dynamic';

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function WeeklyReportsPage() {
  await requireAdminSection('weekly-reports');
  const week = lastFullWeek();
  const [reports, enabled] = await Promise.all([assembleStoreReports(week), weeklyReportsEnabled()]);
  const grand = reports.reduce((s, r) => s + r.total, 0);
  const needsAssociate = reports.reduce((s, r) => s + r.needsAssociate, 0);
  const logOnly = !emailEnabled();

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Weekly HD reports</h1>
          <p className="mt-1 text-sm text-gray-500">Last full week: <strong>{week.label}</strong> · paid (OK) deals only. From/Reply-To <strong>reporter@ghsbarrie.ca</strong>; every recipient BCC'd.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/weekly-reports/attribution" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Credit associates{needsAssociate ? ` (${needsAssociate})` : ''} →</Link>
          <Link href="/admin/store-contacts" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Store contacts →</Link>
        </div>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <MasterSwitch enabled={enabled} />
        <SendNowButton />
      </section>

      {logOnly && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Email is in <strong>log-only</strong> mode in this environment — test sends are simulated. On production they send for real.</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stores with sales</div><div className="mt-1 text-2xl font-bold text-gray-900">{reports.length}</div></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total this week</div><div className="mt-1 text-2xl font-bold text-gray-900">{money(grand)}</div></div>
        <div className={`rounded-2xl border p-4 shadow-sm ${needsAssociate ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}><div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Store leads needing an associate</div><div className={`mt-1 text-2xl font-bold ${needsAssociate ? 'text-amber-700' : 'text-gray-900'}`}>{needsAssociate}</div></div>
      </div>

      {/* National preview */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">National weekly summary</h2>
          <div className="flex items-center gap-3">
            <a href="/admin/weekly-reports/preview/national" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 hover:underline">Open full preview ↗</a>
            <TestNationalButton />
          </div>
        </div>
        <iframe title="National preview" src="/admin/weekly-reports/preview/national" className="h-[520px] w-full border-0 bg-[#eef2f7]" />
      </section>

      {/* Per-store list */}
      <section className="card overflow-x-auto">
        <div className="border-b border-gray-100 px-5 py-3"><h2 className="text-base font-semibold text-gray-900">Per-store reports <span className="text-sm font-normal text-gray-400">· {reports.length}</span></h2></div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-4 py-3">Store</th><th className="px-4 py-3 text-right">Sales</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Recipients</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No paid sales in the last full week.</td></tr>
            ) : reports.map((r) => (
              <tr key={r.storeNumber}>
                <td className="px-4 py-3"><span className="font-mono text-gray-500">{r.storeNumber}</span> <span className="font-medium text-gray-900">{r.storeName}</span>{r.needsAssociate > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{r.needsAssociate} need associate</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.sales.length}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{money(r.total)}</td>
                <td className="px-4 py-3 text-gray-600">{r.to.length} to · {r.cc.length} cc{r.to.length + r.cc.length === 0 ? <span className="ml-1 text-amber-600">⚠ none</span> : ''}</td>
                <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-3"><a href={`/admin/weekly-reports/preview/store/${r.storeNumber}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 hover:underline">Preview ↗</a><TestStoreButton storeNumber={r.storeNumber} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-gray-400">Live Tuesday auto-send and the per-700 associate-attribution screen are the next pieces. For now this previews and test-sends to you only — nothing goes to stores until the master switch is on and the send step is built.</p>
    </div>
  );
}
