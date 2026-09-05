'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LayoutList, Kanban, Table2, GaugeCircle, Search, Eye, AlertTriangle, ArrowRight, type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { PinButton } from '@/components/PinButton';
import { DEAL_COLUMNS, DEAL_GROUPS, type DealGroup, type DealStageKey } from '@/lib/dealerStage';
import type { ApplicationStatus } from '@prisma/client';

export interface DealVM {
  id: string;
  name: string;
  province: string;
  program: string;
  amount: number;
  amountLabel: string;
  status: ApplicationStatus;
  statusLabel: string;
  submitted: string;
  submittedTs: number;
  pinned: boolean;
  hasAction: boolean;
  readyToSubmit: boolean;
  problem: boolean;
  stageKey: DealStageKey;
  stageLabel: string;
  pct: number;
  group: DealGroup;
}

type ViewKey = 'tracker' | 'pipeline' | 'list' | 'progress';
type SortKey = 'newest' | 'oldest' | 'amount_high' | 'amount_low' | 'name';

const VIEWS: { key: ViewKey; label: string; Icon: LucideIcon }[] = [
  { key: 'tracker', label: 'Tracker', Icon: LayoutList },
  { key: 'pipeline', label: 'Pipeline', Icon: Kanban },
  { key: 'list', label: 'List', Icon: Table2 },
  { key: 'progress', label: 'Progress', Icon: GaugeCircle },
];

const PAGE = 12;

function recordView(view: ViewKey) {
  // Fire-and-forget: remembers the last view + feeds usage analytics.
  try {
    fetch('/api/dealer/view-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

function ActionChip({ deal }: { deal: DealVM }) {
  if (deal.problem) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-black leading-none text-white">!</span>
        Sent back
      </span>
    );
  }
  if (deal.readyToSubmit) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Ready to submit</span>;
  }
  if (deal.hasAction) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        <AlertTriangle size={11} /> Action needed
      </span>
    );
  }
  return null;
}

function ProgressBar({ pct, problem }: { pct: number; problem?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full ${problem ? 'bg-red-500' : 'bg-gradient-to-r from-blue-600 to-sky-400'}`}
        style={{ width: `${Math.max(4, pct)}%` }}
      />
    </div>
  );
}

export function ApplicationsWorkspace({ deals, initialView }: { deals: DealVM[]; initialView: ViewKey }) {
  const [view, setView] = useState<ViewKey>(initialView);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);

  function switchView(v: ViewKey) {
    if (v === view) return;
    setView(v);
    setPage(1);
    recordView(v);
  }

  // Filter + sort the base set (pinned always float to the top).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = deals;
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || d.program.toLowerCase().includes(q) || d.province.toLowerCase().includes(q));
    const sorted = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      switch (sort) {
        case 'oldest': return a.submittedTs - b.submittedTs;
        case 'amount_high': return b.amount - a.amount;
        case 'amount_low': return a.amount - b.amount;
        case 'name': return a.name.localeCompare(b.name);
        default: return b.submittedTs - a.submittedTs;
      }
    });
    return sorted;
  }, [deals, query, sort]);

  return (
    <div className="space-y-4">
      {/* Controls: view switcher + search + sort */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {VIEWS.map((v) => {
            const on = v.key === view;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => switchView(v.key)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  on ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <v.Icon size={16} /> {v.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm lg:w-64">
            <Search size={16} className="text-gray-400" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search deals…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none"
            aria-label="Sort deals"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="amount_high">Amount ↑</option>
            <option value="amount_low">Amount ↓</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No customers yet — start with “New customer processing”.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No deals match “{query.trim()}”.
        </div>
      ) : (
        <>
          {view === 'tracker' && <TrackerView deals={filtered} />}
          {view === 'pipeline' && <PipelineView deals={filtered} />}
          {view === 'list' && <ListView deals={filtered} page={page} setPage={setPage} />}
          {view === 'progress' && <ProgressView deals={filtered} page={page} setPage={setPage} />}
        </>
      )}
    </div>
  );
}

/* ---- Tracker: grouped by what needs action ---- */
function TrackerView({ deals }: { deals: DealVM[] }) {
  return (
    <div className="space-y-4">
      {DEAL_GROUPS.map((g) => {
        const items = deals.filter((d) => d.group === g.key);
        if (items.length === 0) return null;
        const accent = g.key === 'action' ? 'border-red-200' : 'border-gray-200';
        return (
          <section key={g.key} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${accent}`}>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
              <div>
                <h3 className={`text-sm font-bold ${g.key === 'action' ? 'text-red-700' : 'text-[#0d2a63] dark:text-slate-100'}`}>
                  {g.label} <span className="ml-1 text-gray-400">{items.length}</span>
                </h3>
                <p className="text-xs text-gray-500">{g.blurb}</p>
              </div>
            </div>
            <ul className="divide-y divide-gray-100">
              {items.map((d) => (
                <li key={d.id}>
                  <Link href={`/dealer/applications/${d.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-blue-600">{d.name}</span>
                        <StatusBadge status={d.status} />
                        <ActionChip deal={d} />
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">{d.program} · {d.province} · {d.amountLabel} · {d.submitted}</div>
                    </div>
                    <ArrowRight size={16} className="flex-none text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ---- Pipeline: columns by stage ---- */
function PipelineView({ deals }: { deals: DealVM[] }) {
  const active = deals.filter((d) => d.group !== 'closed');
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[880px] grid-cols-4 gap-3">
        {DEAL_COLUMNS.map((col) => {
          const items = active.filter((d) => d.stageKey === col.key);
          return (
            <div key={col.key} className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50 dark:bg-white/5">
              <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[#0d2a63] dark:text-slate-100">{col.label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-500 shadow-sm">{items.length}</span>
              </div>
              <div className="space-y-2 p-2">
                {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-gray-400">Nothing here</p>}
                {items.map((d) => (
                  <Link
                    key={d.id}
                    href={`/dealer/applications/${d.id}`}
                    className={`block rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md ${d.problem ? 'border-red-200' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-blue-600">{d.name}</span>
                      {d.pinned && <span className="text-[10px] font-bold text-blue-500">PINNED</span>}
                    </div>
                    <div className="mt-1"><StatusBadge status={d.status} /></div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{d.program}</span>
                      <span className="font-semibold text-gray-700">{d.amountLabel}</span>
                    </div>
                    <div className="mt-2"><ActionChip deal={d} /></div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- List: detailed table (client-side paged) ---- */
function ListView({ deals, page, setPage }: { deals: DealVM[]; page: number; setPage: (n: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(deals.length / PAGE));
  const cur = Math.min(page, pageCount);
  const rows = deals.slice((cur - 1) * PAGE, cur * PAGE);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Mobile cards */}
      <ul className="divide-y divide-gray-100 sm:hidden">
        {rows.map((d) => (
          <li key={d.id} className={d.pinned ? 'bg-blue-50/50' : ''}>
            <Link href={`/dealer/applications/${d.id}`} className="block px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-blue-600">{d.name}</span>
                <StatusBadge status={d.status} />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                <span>{d.program} · {d.province}</span>
                <span className="font-semibold text-gray-700">{d.amountLabel}</span>
              </div>
              <div className="mt-1 flex items-center justify-between"><ActionChip deal={d} /><span className="text-xs text-gray-400">{d.submitted}</span></div>
            </Link>
          </li>
        ))}
      </ul>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
              <th className="w-8 px-2 py-3" aria-label="Pin" />
              <th className="px-4 py-3 text-left">Applicant</th>
              <th className="px-4 py-3 text-left">Province</th>
              <th className="px-4 py-3 text-left">Program</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className={`border-t border-gray-100 hover:bg-gray-50 ${d.pinned ? 'bg-blue-50/50' : ''}`}>
                <td className="px-2 py-3 align-top"><PinButton applicationId={d.id} pinned={d.pinned} /></td>
                <td className="px-4 py-3">
                  <Link href={`/dealer/applications/${d.id}`} className="text-sm font-medium text-blue-600 hover:underline">{d.name}</Link>
                  <div className="mt-1"><ActionChip deal={d} /></div>
                </td>
                <td className="px-4 py-3 text-sm">{d.province}</td>
                <td className="px-4 py-3 text-sm">{d.program}</td>
                <td className="px-4 py-3 text-sm font-medium">{d.amountLabel}</td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3 text-sm text-gray-500">{d.submitted}</td>
                <td className="px-4 py-3">
                  <Link href={`/dealer/applications/${d.id}`} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50">
                    <Eye size={14} /> View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager count={deals.length} page={cur} pageCount={pageCount} setPage={setPage} />
    </div>
  );
}

/* ---- Progress: a stage bar per deal ---- */
function ProgressView({ deals, page, setPage }: { deals: DealVM[]; page: number; setPage: (n: number) => void }) {
  const active = deals.filter((d) => d.group !== 'closed');
  const pageCount = Math.max(1, Math.ceil(active.length / PAGE));
  const cur = Math.min(page, pageCount);
  const rows = active.slice((cur - 1) * PAGE, cur * PAGE);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <ul className="divide-y divide-gray-100">
        {rows.map((d) => (
          <li key={d.id}>
            <Link href={`/dealer/applications/${d.id}`} className="block px-5 py-4 transition hover:bg-gray-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-blue-600">{d.name}<StatusBadge status={d.status} /></span>
                <span className="text-sm font-semibold text-gray-700">{d.amountLabel}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1"><ProgressBar pct={d.pct} problem={d.problem} /></div>
                <span className="flex-none text-xs font-semibold tabular-nums text-gray-500">{d.pct}%</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className={d.problem ? 'font-semibold text-red-600' : 'text-gray-500'}>{d.stageLabel}</span>
                <span className="text-gray-400">{d.program} · {d.province}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pager count={active.length} page={cur} pageCount={pageCount} setPage={setPage} />
    </div>
  );
}

function Pager({ count, page, pageCount, setPage }: { count: number; page: number; pageCount: number; setPage: (n: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
      <span>{count} deal{count === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold disabled:opacity-40 hover:bg-gray-50">Prev</button>
        <span className="tabular-nums">{page} / {pageCount}</span>
        <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold disabled:opacity-40 hover:bg-gray-50">Next</button>
      </div>
    </div>
  );
}
