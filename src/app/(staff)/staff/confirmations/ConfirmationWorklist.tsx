'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProgramType } from '@prisma/client';
import { ProgramBadge } from '@/components/ProgramBadge';
import type { ConfirmationWorkState } from '@/lib/confirmationWork';
import { Phone, Clock, Check, AlertTriangle, Flag, Loader, Search, ListChecks, ChevronRight } from 'lucide-react';

// A pre-formatted worklist row — every display string is computed on the server
// so this component only filters, groups and renders.
export interface CallRow {
  id: string;
  applicant: string;
  office: string;
  programType: ProgramType;
  stageLabel: string;
  state: ConfirmationWorkState;
  checked: number;
  checkTotal: number;
  sortMs: number;
  waitLabel: string;
  overdue: boolean;
  hdRef: string | null;
  searchText: string;
  remaining?: string; // IN_PROGRESS — the checks still outstanding
  issueAwaitingReviewer?: boolean; // ISSUE — office spoke last
  issuePreview?: string | null; // ISSUE — the office's latest message
  doneByLabel?: string | null; // DONE — who confirmed + when
}

type StateMeta = { label: string; pill: string; stripe: string; heading: string; desc: string };
const STATE_META: Record<ConfirmationWorkState, StateMeta> = {
  NEEDS_CALL: { label: 'Needs a call', pill: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300', stripe: 'bg-amber-400', heading: 'Needs a call', desc: 'Signed docs are back — the confirmation call hasn’t been made yet' },
  IN_PROGRESS: { label: 'In progress', pill: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300', stripe: 'bg-blue-500', heading: 'In progress', desc: 'The call was started — some of the six checks are still open' },
  ISSUE: { label: 'Issue · follow-up', pill: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300', stripe: 'bg-red-500', heading: 'Issues · follow-up', desc: 'A flagged issue — office replies waiting on a reviewer surface here' },
  DONE: { label: 'Confirmed', pill: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300', stripe: 'bg-green-500', heading: 'Confirmed today', desc: 'Completed calls from today' },
};

const ORDER: ConfirmationWorkState[] = ['NEEDS_CALL', 'IN_PROGRESS', 'ISSUE', 'DONE'];
const STACK_CAP = 12;
type Filter = 'ALL' | 'OVERDUE' | ConfirmationWorkState;
type ViewMode = 'worklist' | 'list' | 'stacked';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function Meter({ done, total }: { done: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-label={`${done} of ${total} confirmed`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1.5 w-3 rounded-sm ${i < done ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-600'}`} />
      ))}
    </span>
  );
}

function CallCard({ r }: { r: CallRow }) {
  const meta = STATE_META[r.state];
  const stripe = r.overdue ? 'bg-red-500' : meta.stripe;
  const done = r.state === 'DONE';
  const cta = done ? 'View' : r.state === 'ISSUE' ? 'Open' : 'Open call';
  return (
    <Link
      href={`/staff/applications/${r.id}`}
      className={`grid grid-cols-[4px_auto_minmax(0,1fr)_auto] items-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800 ${done ? 'opacity-80' : ''}`}
    >
      <div className={`self-stretch ${stripe}`} aria-hidden />
      <div className="ml-3 grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-sky-950/40 dark:text-sky-300" aria-hidden>
        {initials(r.applicant)}
      </div>
      <div className="min-w-0 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ProgramBadge type={r.programType} />
          <span className="truncate font-semibold text-gray-900 dark:text-slate-100">{r.applicant}</span>
          <span className="rounded-md border border-gray-200 bg-slate-50 px-1.5 py-0.5 text-xs text-gray-500 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300">{r.office}</span>
          <span className="rounded-md border border-gray-200 bg-slate-50 px-1.5 py-0.5 text-xs text-gray-500 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300">{r.stageLabel}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.pill}`}>
            {r.state === 'IN_PROGRESS' ? (
              <span className="inline-flex items-center gap-1.5">{r.checked} of {r.checkTotal} <Meter done={r.checked} total={r.checkTotal} /></span>
            ) : r.state === 'ISSUE' && r.issueAwaitingReviewer ? 'Issue · office replied' : meta.label}
          </span>
        </div>

        {r.state === 'ISSUE' && r.issuePreview && (
          <p className="mt-1.5 line-clamp-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-[13px] text-gray-700 dark:bg-slate-700/40 dark:text-slate-200">“{r.issuePreview}”</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
          <span className={`inline-flex items-center gap-1 ${r.overdue ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>
            {done ? <Check size={13} /> : <Clock size={13} />}
            {done && r.doneByLabel ? `Confirmed by ${r.doneByLabel}` : r.waitLabel}
          </span>
          {r.state === 'IN_PROGRESS' && r.remaining && (<><span className="text-gray-300 dark:text-slate-600" aria-hidden>·</span><span>Left: {r.remaining}</span></>)}
          {r.hdRef && (<><span className="text-gray-300 dark:text-slate-600" aria-hidden>·</span><span className="font-mono tabular-nums">HD {r.hdRef}</span></>)}
        </div>
      </div>
      <span className={`inline-flex items-center gap-0.5 whitespace-nowrap px-3.5 text-sm font-semibold ${done ? 'text-green-700 dark:text-green-400' : 'text-brand-700 dark:text-sky-300'}`}>
        {cta} <ChevronRight size={15} />
      </span>
    </Link>
  );
}

function Band({ heading, desc, rows }: { heading: string; desc: string; rows: CallRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-300">{heading}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-600 dark:bg-slate-700 dark:text-slate-300">{rows.length}</span>
        <span className="ml-auto hidden text-xs text-gray-400 sm:block dark:text-slate-500">{desc}</span>
      </div>
      <div className="flex flex-col gap-2">{rows.map((r) => <CallCard key={r.id} r={r} />)}</div>
    </section>
  );
}

function Kpi({ active, onClick, n, label, icon: Icon, tone }: {
  active: boolean; onClick: () => void; n: number; label: string;
  icon: typeof Phone; tone: string;
}) {
  return (
    <button
      type="button" aria-pressed={active} onClick={onClick}
      className={`rounded-xl border bg-white p-3 text-left shadow-sm transition dark:bg-slate-800 ${active ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200 hover:border-gray-300 dark:border-slate-700'}`}
    >
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{n}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500 dark:text-slate-400"><Icon size={13} /> {label}</div>
    </button>
  );
}

export function ConfirmationWorklist({
  rows, counts,
}: {
  rows: CallRow[];
  counts: Record<ConfirmationWorkState, number>;
}) {
  const [view, setView] = useState<ViewMode>('worklist');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [q, setQ] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('confirmView');
      if (saved === 'worklist' || saved === 'list' || saved === 'stacked') setView(saved);
    } catch { /* storage blocked — use the default */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem('confirmView', view); } catch { /* ignore */ }
  }, [view]);

  const overdueCount = useMemo(() => rows.filter((r) => r.overdue).length, [rows]);
  const outstanding = counts.NEEDS_CALL + counts.IN_PROGRESS + counts.ISSUE;
  const term = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const passFilter = filter === 'ALL' ? true : filter === 'OVERDUE' ? r.overdue : r.state === filter;
      return passFilter && (!term || r.searchText.includes(term));
    });
  }, [rows, filter, term]);

  const byState = useMemo(() => {
    const m: Record<ConfirmationWorkState, CallRow[]> = { NEEDS_CALL: [], IN_PROGRESS: [], ISSUE: [], DONE: [] };
    for (const r of filtered) m[r.state].push(r);
    return m;
  }, [filtered]);

  const KPIS: { key: Filter; n: number; label: string; icon: typeof Phone; tone: string }[] = [
    { key: 'ALL', n: outstanding, label: 'Outstanding', icon: ListChecks, tone: 'text-gray-900 dark:text-slate-100' },
    { key: 'OVERDUE', n: overdueCount, label: 'Overdue', icon: AlertTriangle, tone: 'text-red-600 dark:text-red-400' },
    { key: 'NEEDS_CALL', n: counts.NEEDS_CALL, label: 'Needs a call', icon: Phone, tone: 'text-amber-600 dark:text-amber-400' },
    { key: 'IN_PROGRESS', n: counts.IN_PROGRESS, label: 'In progress', icon: Loader, tone: 'text-blue-600 dark:text-blue-400' },
    { key: 'ISSUE', n: counts.ISSUE, label: 'Issues', icon: Flag, tone: 'text-red-600 dark:text-red-400' },
    { key: 'DONE', n: counts.DONE, label: 'Confirmed', icon: Check, tone: 'text-green-600 dark:text-green-400' },
  ];

  return (
    <div>
      {/* KPI summary — click to filter */}
      <div className="mb-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {KPIS.map((k) => (
          <Kpi key={k.key} active={filter === k.key} onClick={() => setFilter(filter === k.key ? 'ALL' : k.key)} n={k.n} label={k.label} icon={k.icon} tone={k.tone} />
        ))}
      </div>

      {/* Layout toggle + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200 dark:bg-slate-800 dark:ring-slate-700">
          {([['worklist', 'Worklist'], ['list', 'List'], ['stacked', 'Stacked']] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`rounded-full px-3.5 py-1 text-sm font-medium ${view === v ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-400 dark:border-slate-700 dark:bg-slate-800">
          <Search size={15} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, office, HD ref…" aria-label="Search confirmations"
            className="w-40 border-0 bg-transparent p-0 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 dark:text-slate-100 sm:w-56" />
        </div>
      </div>

      {/* Overdue prompt (only when not already filtered to overdue) */}
      {filter !== 'OVERDUE' && overdueCount > 0 && (
        <button type="button" onClick={() => setFilter('OVERDUE')}
          className="mb-5 flex w-full items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-left transition hover:border-red-300 dark:border-red-900/50 dark:bg-red-950/30">
          <span className="text-3xl font-extrabold leading-none tabular-nums text-red-600">{overdueCount}</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-700 dark:text-red-300">overdue — needs attention</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Calls ready 3+ days, or office replies waiting 2+ days. Tap to see just these.</div>
          </div>
          <ChevronRight size={18} className="text-red-400" />
        </button>
      )}

      {view === 'worklist' ? (
        <div className="space-y-7">
          {ORDER.map((s) => <Band key={s} heading={STATE_META[s].heading} desc={STATE_META[s].desc} rows={byState[s]} />)}
          {filtered.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{term || filter !== 'ALL' ? 'Nothing matches this filter.' : 'No confirmation calls outstanding. 🎉'}</div>}
        </div>
      ) : view === 'list' ? (
        filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">Nothing matches this filter.</div>
        ) : (
          <div className="flex flex-col gap-2">{filtered.map((r) => <CallCard key={r.id} r={r} />)}</div>
        )
      ) : (
        <div className="space-y-8">
          {ORDER.map((s) => {
            const list = byState[s];
            if (list.length === 0) return null;
            const capped = list.slice(0, STACK_CAP);
            return (
              <section key={s}>
                <div className="mb-2 flex items-baseline gap-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-300">{STATE_META[s].heading}</h2>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-600 dark:bg-slate-700 dark:text-slate-300">{list.length}</span>
                </div>
                <div className="flex flex-col gap-2">{capped.map((r) => <CallCard key={r.id} r={r} />)}</div>
                {list.length > capped.length && (
                  <div className="mt-2 text-right text-sm">
                    <button type="button" onClick={() => { setView('list'); setFilter(s); }} className="font-medium text-brand-700 hover:underline dark:text-sky-300">See all {list.length} →</button>
                  </div>
                )}
              </section>
            );
          })}
          {filtered.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">Nothing matches this filter.</div>}
        </div>
      )}
    </div>
  );
}
