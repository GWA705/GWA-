'use client';

import { useMemo, useState } from 'react';
import type { LeadsReport, DealerLeads, OutcomeCounts } from '@/lib/reporting/leadsReport';

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

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

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
  const won = g.outcomes.booked + g.outcomes.sold;
  const contacted = g.total - g.outcomes.notCalled;

  return (
    <div className="space-y-5">
      {/* Group summary */}
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total leads" value={g.total} />
          <Stat label="No good" value={g.noGood} accent="#ef4444" />
          <Stat label="Booked / sold" value={won} accent="#10b981" />
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

      <p className="text-center text-xs text-gray-400">
        Drawn from the HD Leads Log and the portal call tracker · generated {fmtWhen(report.generatedAt)}
      </p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">{children}</div>;
}
