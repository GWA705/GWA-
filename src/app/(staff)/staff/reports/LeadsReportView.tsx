'use client';

import { useMemo, useState } from 'react';
import type { LeadsReport, DealerLeads, OutcomeCounts, TrendPoint } from '@/lib/reporting/leadsReport';

// Outcome columns, in the order they read on a call sheet, with a colour used
// for the chips and the distribution bar.
const OUTCOME_COLS: { key: keyof OutcomeCounts; label: string; short: string; color: string }[] = [
  { key: 'notCalled', label: 'Not called', short: 'Not called', color: '#94a3b8' },
  { key: 'na', label: 'No answer', short: 'NA', color: '#f59e0b' },
  { key: 'lm', label: 'Left message', short: 'LM', color: '#0ea5e9' },
  { key: 'spoke', label: 'Spoke', short: 'Spoke', color: '#6366f1' },
  { key: 'booked', label: 'Booked', short: 'Booked', color: '#10b981' },
  { key: 'sold', label: 'Sold', short: 'Sold', color: '#8b5cf6' },
  { key: 'ni', label: 'Not interested', short: 'NI', color: '#ef4444' },
];

// A thin stacked bar showing the outcome distribution.
function DistBar({ o }: { o: OutcomeCounts }) {
  const total = OUTCOME_COLS.reduce((s, c) => s + o[c.key], 0);
  if (total === 0) return <div className="h-2 rounded-full bg-gray-100" />;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
      {OUTCOME_COLS.map((c) =>
        o[c.key] > 0 ? (
          <div key={c.key} style={{ width: `${(o[c.key] / total) * 100}%`, backgroundColor: c.color }} title={`${c.label}: ${o[c.key]}`} />
        ) : null,
      )}
    </div>
  );
}

function OutcomeChips({ o }: { o: OutcomeCounts }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {OUTCOME_COLS.map((c) => (
        <span
          key={c.key}
          className={`inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium ${o[c.key] === 0 ? 'text-gray-400' : 'text-gray-700'}`}
          title={c.label}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: o[c.key] === 0 ? '#cbd5e1' : c.color }} />
          {c.short} <span className="tabular-nums font-semibold">{o[c.key]}</span>
        </span>
      ))}
    </div>
  );
}

function KindBars({ kinds, total }: { kinds: { kind: string; count: number }[]; total: number }) {
  if (kinds.length === 0) return <p className="text-xs text-gray-400">No lead types recorded.</p>;
  const max = Math.max(...kinds.map((k) => k.count), 1);
  return (
    <div className="space-y-1.5">
      {kinds.map((k) => (
        <div key={k.kind} className="flex items-center gap-3 text-xs">
          <span className="w-40 shrink-0 truncate text-gray-600" title={k.kind}>{k.kind}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(k.count / max) * 100}%` }} />
          </div>
          <span className="w-14 shrink-0 text-right tabular-nums font-semibold text-gray-800">
            {k.count}
            <span className="ml-1 font-normal text-gray-400">{total ? `${Math.round((k.count / total) * 100)}%` : ''}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

function DealerCard({ d }: { d: DealerLeads }) {
  const [open, setOpen] = useState(false);
  const contacted = d.total - d.outcomes.notCalled;
  const won = d.outcomes.booked + d.outcomes.sold;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900">{d.dealerName}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {contacted} contacted · {won} booked/sold · {d.noGood} no good
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold tabular-nums text-gray-900">{d.total}</div>
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Leads</div>
        </div>
      </div>
      <div className="px-4">
        <DistBar o={d.outcomes} />
      </div>
      <div className="p-4 pt-3">
        <OutcomeChips o={d.outcomes} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 text-xs font-semibold text-brand-700 hover:underline"
        >
          {open ? 'Hide lead types ▲' : 'Lead types ▾'}
        </button>
        {open && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <KindBars kinds={d.byKind} total={d.total} />
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadsReportView({ report }: { report: LeadsReport }) {
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<'week' | 'month'>('month');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return report.dealers;
    return report.dealers.filter((d) => d.dealerName.toLowerCase().includes(needle));
  }, [q, report.dealers]);

  if (!report.configured) {
    return <Note>The HD Leads Log isn’t connected yet. Add the leads sheet under Reports → Journal connection.</Note>;
  }
  if (report.error) {
    return <Note>Couldn’t read the leads sheet: {report.error}</Note>;
  }

  const g = report.group;
  const contacted = g.total - g.outcomes.notCalled;

  return (
    <div className="space-y-5">
      {report.periodLabel && (
        <div className="rounded-lg bg-[#eef3f6] px-4 py-2 text-sm font-semibold text-[#123448]">
          Showing: {report.periodLabel}
        </div>
      )}

      {/* Group summary */}
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Total leads" value={g.total} />
          <Stat label="No good" value={g.noGood} accent="#ef4444" />
          <Stat label="Booked" value={g.outcomes.booked} accent="#10b981" />
          <Stat label="Sold" value={g.outcomes.sold} accent="#8b5cf6" />
          <Stat label="Dealers" value={g.dealers} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Call activity (all leads)</span>
            <span className="text-xs text-gray-500">{contacted} of {g.total} contacted</span>
          </div>
          <DistBar o={g.outcomes} />
          <div className="mt-2"><OutcomeChips o={g.outcomes} /></div>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Leads by type</div>
          <KindBars kinds={g.byKind} total={g.total} />
        </div>
      </div>

      {/* Lead volume trend */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-900">Lead volume over time</h3>
            <p className="text-xs text-gray-500">Leads received per {period}, with how many booked or sold — to see what HD promotions moved the needle.</p>
          </div>
          <div className="no-print inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setPeriod('week')}
              className={`rounded-md px-3 py-1 font-semibold ${period === 'week' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`rounded-md px-3 py-1 font-semibold ${period === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
            >
              Monthly
            </button>
          </div>
        </div>
        <TrendChart points={period === 'week' ? report.trend.week : report.trend.month} />
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#93c5fd' }} /> Leads</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#10b981' }} /> Booked / sold</span>
          {report.trend.undated > 0 && <span className="text-gray-400">· {report.trend.undated} lead(s) with no date aren’t shown on the chart</span>}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a dealer…"
          className="input flex-1"
          autoComplete="off"
        />
        <span className="text-xs text-gray-400">{filtered.length} of {report.dealers.length}</span>
      </div>

      {/* Per-dealer */}
      {filtered.length === 0 ? (
        <Note>No dealers match “{q}”.</Note>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((d) => (
            <DealerCard key={d.dealerId ?? '__unassigned__'} d={d} />
          ))}
        </div>
      )}

    </div>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return <p className="text-xs text-gray-400">No dated leads to chart yet.</p>;
  const W = 720;
  const H = 200;
  const padL = 26;
  const padR = 8;
  const padT = 12;
  const padB = 26;
  const plotH = H - padT - padB;
  const plotW = W - padL - padR;
  const max = Math.max(1, ...points.map((p) => p.total));
  const slot = plotW / points.length;
  const bw = Math.min(slot * 0.62, 46);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = Array.from(new Set([0, Math.round(max / 2), max]));
  const baseline = padT + plotH;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Lead volume trend">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="#eef2f7" />
            <text x={padL - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{t}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = padL + i * slot + (slot - bw) / 2;
          return (
            <g key={i}>
              <rect x={x} y={y(p.total)} width={bw} height={Math.max(0, baseline - y(p.total))} rx="2" fill="#93c5fd" />
              {p.bookedSold > 0 && (
                <rect x={x} y={y(p.bookedSold)} width={bw} height={Math.max(0, baseline - y(p.bookedSold))} rx="2" fill="#10b981" />
              )}
              {p.total > 0 && (
                <text x={x + bw / 2} y={y(p.total) - 3} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">{p.total}</text>
              )}
              <text x={x + bw / 2} y={H - padB + 12} textAnchor="middle" fontSize="8.5" fill="#6b7280">{p.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">{children}</div>;
}
