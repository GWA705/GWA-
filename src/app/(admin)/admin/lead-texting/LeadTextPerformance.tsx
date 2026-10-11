import Link from 'next/link';
import type { LeadTextPerformance as Perf } from '@/lib/leadTextReport';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-slate-100">{value}</div>
      <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-400 dark:text-slate-500">{sub}</div>}
    </div>
  );
}

function Bar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function LeadTextPerformance({ perf }: { perf: Perf }) {
  const periods = [
    { d: 30, label: '30 days' },
    { d: 90, label: '90 days' },
    { d: 365, label: '12 months' },
  ];

  return (
    <div className="card p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">Performance</h2>
        <div className="inline-flex rounded-full bg-gray-100 p-0.5 text-xs dark:bg-slate-700">
          {periods.map((p) => (
            <Link key={p.d} href={`/admin/lead-texting?days=${p.d}`} scroll={false}
              className={`rounded-full px-2.5 py-1 font-medium ${perf.days === p.d ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {!perf.hasData ? (
        <p className="rounded-lg border border-gray-200 bg-slate-50/60 p-6 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-900/40">
          No texts sent in this period yet. Once messages start going out, their reply and booking rates show here.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Leads texted" value={String(perf.overall.leads)} sub={`${perf.overall.sent} texts sent`} />
            <Stat label="Replied" value={`${perf.overall.replyRate}%`} sub={`${perf.overall.replied} of ${perf.overall.leads}`} />
            <Stat label="Booked" value={`${perf.overall.bookRate}%`} sub={`${perf.overall.booked} of ${perf.overall.bookable} tracked`} />
            <Stat label="Opt-outs" value="—" sub="see Settings · opt-out count" />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400 dark:border-slate-700">
                  <th className="py-2 pr-3 font-medium">Message</th>
                  <th className="py-2 pr-3 text-right font-medium">Sent</th>
                  <th className="py-2 pr-3 font-medium">Reply rate</th>
                  <th className="py-2 font-medium">Booking rate</th>
                </tr>
              </thead>
              <tbody>
                {perf.byKind.map((k) => (
                  <tr key={k.kind} className="border-b border-gray-50 dark:border-slate-700/50">
                    <td className="py-2.5 pr-3 font-medium text-gray-800 dark:text-slate-100">{k.label}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-gray-500 dark:text-slate-400">{k.sent}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-gray-700 dark:text-slate-200">{k.replyRate}%</span>
                        <Bar pct={k.replyRate} tone="bg-blue-500" />
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">{k.replied} of {k.leads}</div>
                    </td>
                    <td className="py-2.5">
                      {k.bookable === 0 ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-gray-700 dark:text-slate-200">{k.bookRate}%</span>
                            <Bar pct={k.bookRate} tone="bg-green-500" />
                          </div>
                          <div className="mt-0.5 text-[11px] text-gray-400">{k.booked} of {k.bookable}</div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {perf.recentReplies.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Recent replies</h3>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {perf.recentReplies.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-gray-800 dark:text-slate-100">{r.customerName || 'Customer'}</span>
                      {r.text && <span className="text-gray-600 dark:text-slate-300"> — “{r.text}”</span>}
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{r.at}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-[11px] text-gray-400 dark:text-slate-500">
            Reply rate counts customers who texted back (not STOP/HELP). Booking rate is tracked for in-store &amp; mail-in
            leads (we hold their booking status); online HD leads count toward replies only. Access is logged (PIPEDA).
          </p>
        </>
      )}
    </div>
  );
}
