import type { ResolutionStatsVM } from '@/lib/resolutionCases';

/**
 * "At a glance" overview for the HD Resolution Centre — a navy KPI hero, the live
 * pipeline mix, and an 8-week opened-vs-resolved trend. Server-rendered, no client
 * JS; all figures come from loadResolutionStats(). Colours use the portal's own
 * palette (navy #0e2b5c / brand blue) and the status tones used elsewhere.
 */

// Status-tone colours (match TONE_CLASS in resolutionStatus.ts), for the pipeline.
const PIPE_COLOR: Record<string, string> = {
  OPEN: '#2563eb',
  IN_PROGRESS: '#f97316',
  WAITING_ON_OFFICE: '#f59e0b',
  ESCALATED_HD: '#ef4444',
};

function Kpi({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-3xl font-extrabold leading-none tracking-tight text-white tabular-nums sm:text-[2rem]">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">{label}</div>
      {sub && <div className="mt-1 text-xs text-white/70">{sub}</div>}
    </div>
  );
}

function TrendChart({ weeks }: { weeks: ResolutionStatsVM['weeks'] }) {
  const W = 360, H = 150, padL = 8, padR = 8, padT = 14, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baseY = padT + plotH;
  const groupW = plotW / weeks.length;
  const inset = Math.min(7, groupW * 0.16);
  const gap = 4;
  const barW = Math.max(3, (groupW - inset * 2 - gap) / 2);
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.opened, w.resolved)));
  const barH = (v: number) => (v / max) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Opened vs resolved, last 8 weeks">
      {/* baseline */}
      <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} className="stroke-gray-200 dark:stroke-slate-700" strokeWidth={1} />
      {weeks.map((w, i) => {
        const gx = padL + i * groupW;
        const ox = gx + inset;
        const rx = ox + barW + gap;
        const oh = barH(w.opened);
        const rh = barH(w.resolved);
        return (
          <g key={i} className="gwa-grow-up" style={{ transformOrigin: `0 ${baseY}px` }}>
            <rect x={ox} y={baseY - oh} width={barW} height={oh} rx={2} fill="#2563eb" />
            <rect x={rx} y={baseY - rh} width={barW} height={rh} rx={2} fill="#16a34a" />
            <text x={gx + groupW / 2} y={H - 9} textAnchor="middle" fontSize={8} className="fill-gray-400 dark:fill-slate-500">
              {w.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ResolutionStatsHeader({ stats }: { stats: ResolutionStatsVM }) {
  const {
    live, aging, overdue, awaitingReply, longestWaitDays, avgResolveDays,
    resolvedThisMonth, openedThisMonth, pipeline, weeks, topOffices,
  } = stats;
  const pipelineTotal = pipeline.reduce((s, p) => s + p.count, 0);

  return (
    <section className="space-y-4">
      {/* KPI hero — navy band, reads in both themes */}
      <div
        className="rounded-2xl p-5 shadow-sm sm:p-6"
        style={{ background: 'linear-gradient(135deg, #0e2b5c 0%, #143a7a 55%, #1d4ed8 140%)' }}
      >
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Kpi
            value={String(live)}
            label="Live cases"
            sub={
              live === 0 ? (
                <span className="text-emerald-300">all clear</span>
              ) : (
                <>
                  <span className={aging ? 'text-amber-300' : 'text-white/50'}>{aging} aging</span>
                  <span className="text-white/30"> · </span>
                  <span className={overdue ? 'font-semibold text-red-300' : 'text-white/50'}>{overdue} overdue</span>
                </>
              )
            }
          />
          <Kpi
            value={String(awaitingReply)}
            label="Awaiting our reply"
            sub={
              longestWaitDays != null ? (
                <span className={longestWaitDays >= 5 ? 'font-semibold text-red-300' : 'text-amber-300'}>
                  longest {longestWaitDays}d
                </span>
              ) : (
                <span className="text-white/50">nothing owed</span>
              )
            }
          />
          <Kpi
            value={avgResolveDays != null ? `${avgResolveDays}d` : '—'}
            label="Avg. time to resolve"
            sub={<span className="text-white/60">{resolvedThisMonth} resolved this month</span>}
          />
          <Kpi
            value={String(resolvedThisMonth)}
            label="Resolved · this month"
            sub={<span className="text-white/60">{openedThisMonth} opened this month</span>}
          />
        </div>
      </div>

      {/* Pipeline + trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Live pipeline */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Live pipeline</h3>
          {pipelineTotal === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">No live cases — the board is clear. 🎉</p>
          ) : (
            <>
              <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                {pipeline.map((p) =>
                  p.count ? (
                    <div
                      key={p.status}
                      style={{ width: `${(p.count / pipelineTotal) * 100}%`, background: PIPE_COLOR[p.status] }}
                      title={`${p.label}: ${p.count}`}
                    />
                  ) : null,
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {pipeline.map((p) => (
                  <div key={p.status} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIPE_COLOR[p.status] }} />
                    <span className="min-w-0 truncate text-gray-600 dark:text-slate-300">{p.label}</span>
                    <span className="ml-auto font-bold tabular-nums text-gray-900 dark:text-slate-100">{p.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {topOffices.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3 dark:border-slate-700">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Live by office</h4>
              <div className="mt-2 space-y-1.5">
                {topOffices.map((o) => (
                  <div key={o.name} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 truncate text-gray-600 dark:text-slate-300">{o.name}</span>
                    <span className="ml-auto font-semibold tabular-nums text-gray-700 dark:text-slate-200">{o.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Trend */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Opened vs resolved · 8 weeks</h3>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-gray-600 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#2563eb' }} />Opened</span>
              <span className="flex items-center gap-1 text-gray-600 dark:text-slate-300"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#16a34a' }} />Resolved</span>
            </div>
          </div>
          <div className="mt-2">
            <TrendChart weeks={weeks} />
          </div>
        </div>
      </div>
    </section>
  );
}
