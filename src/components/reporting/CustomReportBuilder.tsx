'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ReportRow } from '@/lib/reporting/reportDataset';
import { saveCustomReport, deleteCustomReport, type SavedReportVM } from '@/app/(dealer)/dealer/reports/customActions';

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type Measure = 'count' | 'total' | 'avg';
type Dimension = 'ym' | 'program' | 'status' | 'salesperson' | 'province' | 'product';
type Range = 'all' | 'ytd' | '12m' | '3m';

const MEASURES: { key: Measure; label: string }[] = [
  { key: 'count', label: 'Number of deals' },
  { key: 'total', label: 'Total value ($)' },
  { key: 'avg', label: 'Average value ($)' },
];
const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'ym', label: 'Month' },
  { key: 'program', label: 'Program' },
  { key: 'status', label: 'Status' },
  { key: 'salesperson', label: 'Salesperson' },
  { key: 'province', label: 'Province' },
  { key: 'product', label: 'Product' },
];
const RANGES: { key: Range; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'ytd', label: 'This year' },
  { key: '12m', label: 'Last 12 months' },
  { key: '3m', label: 'Last 3 months' },
];

function cutoffYm(range: Range): string | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'ytd') return `${now.getFullYear()}-01`;
  const back = range === '12m' ? 11 : 2;
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
};

interface Agg { key: string; label: string; count: number; total: number; avg: number; }

/**
 * A curated custom-report builder: choose a measure, a group-by, a date range
 * and status filters, and see a live table + bar chart. Runs in the browser over
 * the office's own deals — instant, tenant-isolated.
 */
export function CustomReportBuilder({ rows, saved = [] }: { rows: ReportRow[]; saved?: SavedReportVM[] }) {
  const [measure, setMeasure] = useState<Measure>('count');
  const [dimension, setDimension] = useState<Dimension>('ym');
  const [range, setRange] = useState<Range>('12m');
  const [statuses, setStatuses] = useState<Set<string>>(new Set());

  const [savedList, setSavedList] = useState<SavedReportVM[]>(saved);
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function loadSaved(s: SavedReportVM) {
    setMeasure(s.config.measure as Measure);
    setDimension(s.config.dimension as Dimension);
    setRange(s.config.range as Range);
    setStatuses(new Set(s.config.statuses ?? []));
    setNote(`Loaded “${s.name}”.`);
  }

  function doSave() {
    const trimmed = name.trim();
    if (!trimmed) { setNote('Give the report a name first.'); return; }
    start(async () => {
      const res = await saveCustomReport({ name: trimmed, config: { measure, dimension, range, statuses: [...statuses] } });
      if ('error' in res) { setNote(res.error); return; }
      setSavedList((prev) => [{ id: res.id, name: res.name, config: { measure, dimension, range, statuses: [...statuses] } }, ...prev]);
      setName('');
      setNote(`Saved “${res.name}”.`);
    });
  }

  function doDelete(id: string) {
    start(async () => {
      const res = await deleteCustomReport(id);
      if ('error' in res) { setNote(res.error); return; }
      setSavedList((prev) => prev.filter((s) => s.id !== id));
    });
  }

  const allStatuses = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (!m.has(r.statusRaw)) m.set(r.statusRaw, r.status);
    return [...m.entries()].map(([raw, label]) => ({ raw, label }));
  }, [rows]);

  const { aggs, dealsInScope, valueInScope } = useMemo(() => {
    const cut = cutoffYm(range);
    const scope = rows.filter((r) => {
      if (cut && r.ym < cut) return false;
      if (statuses.size > 0 && !statuses.has(r.statusRaw)) return false;
      return true;
    });

    const map = new Map<string, { label: string; count: number; total: number }>();
    const add = (key: string, label: string, amount: number) => {
      const b = map.get(key) ?? { label, count: 0, total: 0 };
      b.count += 1;
      b.total += amount;
      map.set(key, b);
    };
    for (const r of scope) {
      if (dimension === 'product') {
        const seen = new Set<string>();
        for (const p of r.products) {
          const k = p.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          add(k, p, r.amount);
        }
      } else {
        const label = String(r[dimension]);
        add(dimension === 'ym' ? label : label.toLowerCase(), dimension === 'ym' ? fmtMonth(label) : label, r.amount);
      }
    }
    const list: Agg[] = [...map.entries()].map(([key, v]) => ({
      key, label: v.label, count: v.count, total: v.total, avg: v.count ? v.total / v.count : 0,
    }));
    const valueOf = (a: Agg) => (measure === 'count' ? a.count : measure === 'total' ? a.total : a.avg);
    if (dimension === 'ym') list.sort((a, b) => a.key.localeCompare(b.key));
    else list.sort((a, b) => valueOf(b) - valueOf(a));

    return {
      aggs: list,
      dealsInScope: scope.length,
      valueInScope: scope.reduce((s, r) => s + r.amount, 0),
    };
  }, [rows, dimension, range, statuses, measure]);

  const valueOf = (a: Agg) => (measure === 'count' ? a.count : measure === 'total' ? a.total : a.avg);
  const fmtVal = (n: number) => (measure === 'count' ? String(n) : money(n));
  const peak = Math.max(1, ...aggs.map(valueOf));

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3">
        <h3 className="text-base font-bold text-gray-900">Custom report</h3>
        <p className="text-xs text-gray-500">Pick what to measure, how to group it, and the range. Your office only.</p>
      </div>

      {/* Saved reports + save current view */}
      <div className="space-y-3 border-b border-gray-100 bg-blue-50/50 px-5 py-3">
        {savedList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Saved</span>
            {savedList.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1 text-sm">
                <button type="button" onClick={() => loadSaved(s)} className="font-medium text-blue-700 hover:underline">{s.name}</button>
                <button type="button" onClick={() => doDelete(s.id)} disabled={pending} aria-label={`Delete ${s.name}`} className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-600">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this report…"
            maxLength={80}
            className="input h-9 w-56 text-sm"
          />
          <button type="button" onClick={doSave} disabled={pending} className="btn-primary text-sm disabled:opacity-50">
            {pending ? 'Saving…' : 'Save current view'}
          </button>
          {note && <span className="text-xs text-gray-500">{note}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-gray-50 p-4 sm:grid-cols-3">
        <Field label="Measure">
          <select value={measure} onChange={(e) => setMeasure(e.target.value as Measure)} className="input">
            {MEASURES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Group by">
          <select value={dimension} onChange={(e) => setDimension(e.target.value as Dimension)} className="input">
            {DIMENSIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Date range">
          <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="input">
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </Field>
      </div>

      {allStatuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</span>
          {allStatuses.map((s) => {
            const on = statuses.has(s.raw);
            return (
              <button
                key={s.raw}
                type="button"
                onClick={() => setStatuses((prev) => { const n = new Set(prev); if (n.has(s.raw)) n.delete(s.raw); else n.add(s.raw); return n; })}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {s.label}
              </button>
            );
          })}
          {statuses.size > 0 && <button type="button" onClick={() => setStatuses(new Set())} className="text-xs font-semibold text-gray-400 hover:text-red-600">Clear</button>}
        </div>
      )}

      <div className="flex flex-wrap gap-4 px-5 py-3 text-sm">
        <span className="text-gray-500">In range: <strong className="text-gray-900">{dealsInScope}</strong> deals</span>
        <span className="text-gray-500">Total value: <strong className="text-gray-900">{money(valueInScope)}</strong></span>
      </div>

      {aggs.length === 0 ? (
        <p className="px-5 pb-8 text-center text-sm text-gray-500">No deals match this range/filter.</p>
      ) : (
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="px-4 py-2 text-left">{DIMENSIONS.find((d) => d.key === dimension)?.label}</th>
                <th className="px-4 py-2 text-left">{MEASURES.find((m) => m.key === measure)?.label}</th>
                <th className="px-4 py-2 text-right">Deals</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Avg</th>
              </tr>
            </thead>
            <tbody>
              {aggs.map((a) => (
                <tr key={a.key} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{a.label}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400" style={{ width: `${Math.max(3, (valueOf(a) / peak) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold tabular-nums text-gray-900">{fmtVal(valueOf(a))}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-500">{a.count}</td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-500">{money(a.total)}</td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-500">{money(a.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dimension === 'product' && (measure !== 'count') && (
            <p className="px-4 pt-2 text-xs text-gray-400">
              Note: a deal has one total, so when grouping $ by product a multi-product deal&rsquo;s full amount is counted under each of its products.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
