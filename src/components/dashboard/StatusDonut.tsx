const COLORS = { approved: '#16a34a', pending: '#2196f3', declined: '#ef4444' };

function Legend({ color, label, count, pct }: { color: string; label: string; count: number; pct: number }) {
  return (
    <div className="grid grid-cols-[14px_1fr_auto] items-center gap-2 text-sm">
      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
      <span className="text-slate-700">{label}</span>
      <span className="tabular-nums text-slate-500">{count} ({pct}%)</span>
    </div>
  );
}

/** Applications-by-status donut, driven by real counts. */
export function StatusDonut({ approved, pending, declined }: { approved: number; pending: number; declined: number }) {
  const total = approved + pending + declined;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const deg = (n: number) => (total ? (n / total) * 360 : 0);
  const a = deg(approved);
  const p = deg(pending);
  const gradient = total
    ? `conic-gradient(${COLORS.approved} 0 ${a}deg, ${COLORS.pending} ${a}deg ${a + p}deg, ${COLORS.declined} ${a + p}deg 360deg)`
    : '#e5e7eb';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-bold text-[#0d2a63]">Applications by Status</h3>
      <div className="flex items-center justify-around py-5">
        <div className="relative h-32 w-32 rounded-full" style={{ background: gradient }}>
          <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white">
            <div className="text-2xl font-bold text-[#10265a]">{total}</div>
            <div className="text-xs text-slate-500">Total</div>
          </div>
        </div>
        <div className="space-y-3">
          <Legend color={COLORS.approved} label="Approved" count={approved} pct={pct(approved)} />
          <Legend color={COLORS.pending} label="Pending" count={pending} pct={pct(pending)} />
          <Legend color={COLORS.declined} label="Declined" count={declined} pct={pct(declined)} />
        </div>
      </div>
    </div>
  );
}
