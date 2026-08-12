import type { OfficeMonthlyReport, StoreRow } from '@/lib/reporting/monthly';

// Portal-styled per-office monthly performance report.

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}
function money2(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Pct({ value }: { value: number | null }) {
  if (value === null) return <span className="font-semibold text-emerald-600">New</span>;
  const up = value >= 0;
  return <span className={`font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>{up ? '+' : ''}{value}%</span>;
}

function Row({ r, bold }: { r: StoreRow; bold?: boolean }) {
  const base = bold ? 'font-bold text-white' : 'text-gray-800';
  const cell = 'px-2 py-2 text-right tabular-nums';
  return (
    <tr className={bold ? 'bg-slate-800' : 'border-t border-gray-100'}>
      <td className={`px-3 py-2 text-left ${bold ? 'font-bold text-white' : 'font-semibold text-gray-900'}`}>{r.label}</td>
      <td className={`${cell} ${base}`}>{money(r.prevMonth)}</td>
      <td className={`${cell} ${bold ? 'text-white' : 'font-semibold text-gray-900'}`}>{money(r.curMonth)}</td>
      <td className={cell}>
        <Pct value={r.momPct} />
      </td>
      <td className={`${cell} ${base} hidden sm:table-cell`}>{money(r.lyMonth)}</td>
      <td className={`${cell} hidden sm:table-cell`}>
        <Pct value={r.yoyPct} />
      </td>
      <td className={`${cell} ${base}`}>{money(r.ytdTy)}</td>
      <td className={`${cell} ${base} hidden md:table-cell`}>{money(r.ytdLy)}</td>
      <td className={cell}>
        <Pct value={r.ytdPct} />
      </td>
    </tr>
  );
}

function PendingBlock({
  title,
  subtitle,
  rows,
  total,
  byMonth,
}: {
  title: string;
  subtitle: string;
  rows: { store: string; label: string; amount: number; count: number }[];
  total: number;
  byMonth?: { label: string; total: number; count: number }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
      <div className="border-b border-amber-200 px-4 py-2.5">
        <h3 className="text-sm font-bold text-amber-900">{title}</h3>
        <p className="text-xs text-amber-700">{subtitle}</p>
      </div>
      {byMonth && byMonth.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-amber-100 bg-amber-100/50 px-4 py-2">
          {byMonth.map((m) => (
            <span key={m.label} className="rounded-full bg-white/70 px-2.5 py-1 text-xs text-amber-900">
              {m.label}: <span className="font-semibold tabular-nums">{money2(m.total)}</span>{' '}
              <span className="text-amber-500">({m.count})</span>
            </span>
          ))}
        </div>
      )}
      <div className="divide-y divide-amber-100">
        {rows.map((p) => (
          <div key={p.store} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="font-semibold text-amber-900">{p.label}</span>
            <span className="tabular-nums text-amber-800">
              {money2(p.amount)} <span className="text-amber-500">({p.count})</span>
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">
          <span>Total pending</span>
          <span className="tabular-nums">{money2(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function MonthlyReportView({ report }: { report: OfficeMonthlyReport }) {
  const t = report.ytd;
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl" style={{ background: 'linear-gradient(135deg,#1a2e44,#243d5c)' }}>
        <div className="p-5 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">GWA HD · Monthly Performance</div>
          <h1 className="text-xl font-bold">{report.office?.name ?? 'Office'}</h1>
          <div className="mt-0.5 text-sm text-white/70">{report.monthLabel}</div>
        </div>
      </div>

      {report.error && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t fully read the journals: {report.error}. Numbers may be incomplete.
        </div>
      )}
      {report.office && report.office.storeNumbers.length === 0 && (
        <div className="rounded-lg border-l-4 border-sky-500 bg-sky-50 p-3 text-sm text-sky-800">
          This office has no Home Depot store numbers assigned yet. Add them under Admin → Dealers so the report can
          attribute journal sales to it.
        </div>
      )}

      {/* Main table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 text-left font-medium">Store</th>
                <th className="px-2 py-2 text-right font-medium">Prev mo.</th>
                <th className="px-2 py-2 text-right font-medium">This mo.</th>
                <th className="px-2 py-2 text-right font-medium">M/M</th>
                <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">LY mo.</th>
                <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">Y/Y</th>
                <th className="px-2 py-2 text-right font-medium">YTD</th>
                <th className="px-2 py-2 text-right font-medium hidden md:table-cell">YTD LY</th>
                <th className="px-2 py-2 text-right font-medium">YTD %</th>
              </tr>
            </thead>
            <tbody>
              {report.stores.map((r) => (
                <Row key={r.store} r={r} />
              ))}
              <Row r={report.total} bold />
            </tbody>
          </table>
        </div>
      </div>

      {/* PE/OK pending — this month */}
      {report.pendingThisMonth.length > 0 && (
        <PendingBlock
          title="PE/OK — Pending installation (this month)"
          subtitle="Sold this month, awaiting install — not included in the totals above."
          rows={report.pendingThisMonth}
          total={report.pendingThisMonthTotal}
        />
      )}

      {/* PE/OK pending — earlier months, still outstanding */}
      {report.pendingEarlier.length > 0 && (
        <PendingBlock
          title="PE/OK — Pending from earlier months"
          subtitle="Sold in a previous month and still awaiting install."
          rows={report.pendingEarlier}
          total={report.pendingEarlierTotal}
          byMonth={report.pendingEarlierByMonth}
        />
      )}

      {/* YTD summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-lg font-bold text-gray-900 tabular-nums">{money(t.ty)}</div>
          <div className="text-[10px] uppercase text-gray-500">YTD this year</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-lg font-bold text-gray-900 tabular-nums">{money(t.ly)}</div>
          <div className="text-[10px] uppercase text-gray-500">YTD last year</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-lg font-bold tabular-nums">
            <Pct value={t.pct} />
          </div>
          <div className="text-[10px] uppercase text-gray-500">YTD vs last year</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className={`text-lg font-bold tabular-nums ${t.gap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {t.gap >= 0 ? '+' : '−'}
            {money(Math.abs(t.gap))}
          </div>
          <div className="text-[10px] uppercase text-gray-500">Dollar gap</div>
        </div>
      </div>

      {report.deadStores.length > 0 && (
        <p className="text-xs text-gray-400">
          No sales this month: {report.deadStores.join(', ')}
        </p>
      )}

      <p className="text-[11px] text-gray-400">
        Money basis: OK (paid) receivable, dated by Date Paid. PE/OK shown separately (awaiting install). Sourced from the
        sales journals.
      </p>
    </div>
  );
}
