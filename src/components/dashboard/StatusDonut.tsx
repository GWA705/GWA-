import { getT } from '@/i18n/server';

const COLORS = { approved: '#16a34a', pending: '#2563eb', declined: '#ef4444' };
const TRACK = 'var(--donut-track, #eef2f8)';

// Geometry for the SVG ring.
const R = 52;
const STROKE = 13;
const C = 2 * Math.PI * R;

function Legend({ color, label, count, pct }: { color: string; label: string; count: number; pct: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-2.5 w-2.5 flex-none rounded-full ring-2 ring-white/70 dark:ring-white/10" style={{ background: color }} />
      <span className="flex-1 text-sm font-medium text-gray-600">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[#10265a] dark:text-slate-100">{count}</span>
      <span className="w-11 text-right text-xs font-medium tabular-nums text-gray-400">{pct}%</span>
    </div>
  );
}

/** Applications-by-status donut, driven by real counts. */
export function StatusDonut({ approved, pending, declined }: { approved: number; pending: number; declined: number }) {
  const t = getT();
  const total = approved + pending + declined;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const segs = [
    { color: COLORS.approved, value: approved },
    { color: COLORS.pending, value: pending },
    { color: COLORS.declined, value: declined },
  ].filter((s) => s.value > 0);

  // Round caps + a small gap look premium with 2+ segments; a lone 100% segment
  // draws as a clean full ring (no gap/cap seam).
  const gap = segs.length > 1 ? 7 : 0;
  let acc = 0;
  const arcs = segs.map((s) => {
    const frac = s.value / total;
    const len = Math.max(0, frac * C - gap);
    const rotate = acc * 360 - 90;
    acc += frac;
    return { color: s.color, len, rotate, round: gap > 0 };
  });

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_30px_-18px_rgba(16,24,40,.22)]">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[#0d2a63] dark:text-slate-100">{t('dashboard.byStatus')}</h3>
      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:justify-between sm:gap-4">
        <div className="relative h-[132px] w-[132px] flex-none">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-0">
            <circle cx="60" cy="60" r={R} fill="none" stroke={TRACK} strokeWidth={STROKE} />
            {arcs.map((a, i) => (
              <circle
                key={i}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={STROKE}
                strokeLinecap={a.round ? 'round' : 'butt'}
                strokeDasharray={`${a.len} ${C - a.len}`}
                transform={`rotate(${a.rotate} 60 60)`}
                className="gwa-donut-arc"
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[28px] font-extrabold leading-none text-[#10265a] dark:text-slate-100">{total}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">{t('dashboard.total')}</div>
          </div>
        </div>
        <div className="w-full max-w-[230px] space-y-3">
          <Legend color={COLORS.approved} label={t('dashboard.approved')} count={approved} pct={pct(approved)} />
          <Legend color={COLORS.pending} label={t('dashboard.pending')} count={pending} pct={pct(pending)} />
          <Legend color={COLORS.declined} label={t('dashboard.declined')} count={declined} pct={pct(declined)} />
        </div>
      </div>
    </div>
  );
}
