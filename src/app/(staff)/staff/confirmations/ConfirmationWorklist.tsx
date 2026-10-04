'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProgramType } from '@prisma/client';
import { ProgramBadge } from '@/components/ProgramBadge';
import type { ConfirmationWorkState } from '@/lib/confirmationWork';

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
  NEEDS_CALL: {
    label: 'Needs a call',
    pill: 'bg-amber-100 text-amber-800',
    stripe: 'bg-amber-400',
    heading: 'Needs a call',
    desc: 'Signed docs are back — the confirmation call hasn’t been made yet',
  },
  IN_PROGRESS: {
    label: 'In progress',
    pill: 'bg-blue-100 text-blue-800',
    stripe: 'bg-blue-500',
    heading: 'In progress',
    desc: 'The call was started — some of the six checks are still open',
  },
  ISSUE: {
    label: 'Issue · follow-up',
    pill: 'bg-red-100 text-red-700',
    stripe: 'bg-red-500',
    heading: 'Issues · follow-up',
    desc: 'A flagged issue — office replies waiting on a reviewer surface here',
  },
  DONE: {
    label: 'Confirmed',
    pill: 'bg-green-100 text-green-800',
    stripe: 'bg-green-500',
    heading: 'Confirmed today',
    desc: 'Completed calls from today',
  },
};

const ORDER: ConfirmationWorkState[] = ['NEEDS_CALL', 'IN_PROGRESS', 'ISSUE', 'DONE'];

function Meter({ done, total }: { done: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-label={`${done} of ${total} confirmed`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1.5 w-3 rounded-sm ${i < done ? 'bg-blue-500' : 'bg-gray-200'}`} />
      ))}
    </span>
  );
}

function CallCard({ r }: { r: CallRow }) {
  const meta = STATE_META[r.state];
  const stripe = r.overdue ? 'bg-red-500' : meta.stripe;
  const done = r.state === 'DONE';
  return (
    <Link
      href={`/staff/applications/${r.id}`}
      className={`card grid grid-cols-[5px_minmax(0,1fr)_auto] items-stretch overflow-hidden p-0 transition hover:ring-2 hover:ring-brand-500 ${done ? 'opacity-75' : ''}`}
    >
      <div className={stripe} aria-hidden />
      <div className="min-w-0 py-3 pl-3 pr-2 sm:pl-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProgramBadge type={r.programType} />
          <span className="truncate font-medium text-brand-700">{r.applicant}</span>
          <span className="text-xs text-gray-500">· {r.office}</span>
          <span className="badge bg-gray-100 text-gray-600 whitespace-nowrap">{r.stageLabel}</span>
          <span className={`badge whitespace-nowrap ${meta.pill}`}>
            {r.state === 'IN_PROGRESS' ? (
              <span className="inline-flex items-center gap-1.5">
                {r.checked} of {r.checkTotal} <Meter done={r.checked} total={r.checkTotal} />
              </span>
            ) : r.state === 'ISSUE' && r.issueAwaitingReviewer ? (
              'Issue · office replied'
            ) : (
              meta.label
            )}
          </span>
        </div>

        {r.state === 'ISSUE' && r.issuePreview && (
          <p className="mt-1.5 line-clamp-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-[13px] text-gray-700">
            “{r.issuePreview}”
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          {r.state === 'DONE' && r.doneByLabel ? (
            <span>Confirmed by {r.doneByLabel}</span>
          ) : (
            <span className={r.overdue ? 'font-semibold text-red-700' : ''}>{r.waitLabel}</span>
          )}
          {r.state === 'IN_PROGRESS' && r.remaining && (
            <>
              <span className="text-gray-300" aria-hidden>·</span>
              <span>Left: {r.remaining}</span>
            </>
          )}
          {r.hdRef && (
            <>
              <span className="text-gray-300" aria-hidden>·</span>
              <span className="tabular-nums">HD {r.hdRef}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center justify-self-end px-3 text-sm font-medium text-brand-700">
        {done ? 'View →' : r.state === 'ISSUE' ? 'Open →' : 'Open call →'}
      </div>
    </Link>
  );
}

function Band({ state, rows }: { state: ConfirmationWorkState; rows: CallRow[] }) {
  const meta = STATE_META[state];
  if (rows.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700">{meta.heading}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 tabular-nums">{rows.length}</span>
        <span className="ml-auto hidden text-xs text-gray-400 sm:block">{meta.desc}</span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <CallCard key={r.id} r={r} />
        ))}
      </div>
    </section>
  );
}

type ViewMode = 'worklist' | 'tabs' | 'stacked';
type TabKey = ConfirmationWorkState | 'ALL';
const STACK_CAP = 12;

export function ConfirmationWorklist({
  rows,
  counts,
}: {
  rows: CallRow[];
  counts: Record<ConfirmationWorkState, number>;
}) {
  const [view, setView] = useState<ViewMode>('worklist');
  const [tab, setTab] = useState<TabKey>('NEEDS_CALL');
  const [q, setQ] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('confirmView');
      if (saved === 'worklist' || saved === 'tabs' || saved === 'stacked') setView(saved);
    } catch {
      /* storage blocked — use the default */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem('confirmView', view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const byState = useMemo(() => {
    const m: Record<ConfirmationWorkState, CallRow[]> = { NEEDS_CALL: [], IN_PROGRESS: [], ISSUE: [], DONE: [] };
    for (const r of rows) m[r.state].push(r);
    return m;
  }, [rows]);

  const outstanding = counts.NEEDS_CALL + counts.IN_PROGRESS + counts.ISSUE;
  const overdueCount = useMemo(() => rows.filter((r) => r.overdue).length, [rows]);

  const term = q.trim().toLowerCase();
  const tabRows = useMemo(() => {
    const base = tab === 'ALL' ? rows : byState[tab];
    if (!term) return base;
    return base.filter((r) => r.searchText.includes(term));
  }, [tab, rows, byState, term]);

  const allCount = rows.length;

  return (
    <div>
      {/* Layout toggle — same three views as the reviewer Deals queue. */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-400">View</span>
        <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200">
          {([
            ['worklist', 'Worklist'],
            ['tabs', 'Tabs'],
            ['stacked', 'Stacked'],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-3.5 py-1 text-sm font-medium ${view === v ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-500">
          <span className="font-semibold text-gray-700 tabular-nums">{outstanding}</span> outstanding
        </span>
      </div>

      {view === 'worklist' ? (
        <div className="space-y-7">
          {overdueCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <span className="text-3xl font-extrabold leading-none text-red-600 tabular-nums">{overdueCount}</span>
              <div>
                <div className="text-sm font-semibold text-red-700">overdue — needs attention</div>
                <div className="text-xs text-gray-500">Calls ready 3+ days, or office replies waiting 2+ days.</div>
              </div>
            </div>
          )}
          <Band state="NEEDS_CALL" rows={byState.NEEDS_CALL} />
          <Band state="IN_PROGRESS" rows={byState.IN_PROGRESS} />
          <Band state="ISSUE" rows={byState.ISSUE} />
          <Band state="DONE" rows={byState.DONE} />
          {outstanding === 0 && byState.DONE.length === 0 && (
            <div className="card p-8 text-center text-sm text-gray-500">No confirmation calls outstanding. 🎉</div>
          )}
        </div>
      ) : view === 'tabs' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {([
              ['NEEDS_CALL', 'Needs a call', counts.NEEDS_CALL],
              ['IN_PROGRESS', 'In progress', counts.IN_PROGRESS],
              ['ISSUE', 'Issues · follow-up', counts.ISSUE],
              ['DONE', 'Confirmed today', counts.DONE],
              ['ALL', 'All', allCount],
            ] as const).map(([k, label, n]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                  tab === k ? 'border-brand-600 bg-brand-50 font-semibold text-brand-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {label}
                <span className={`rounded-full px-1.5 text-xs font-bold tabular-nums ${tab === k ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{n}</span>
              </button>
            ))}
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, office, HD ref…"
              aria-label="Search confirmations"
              className="input h-9 w-full min-w-0 py-1 sm:ml-auto sm:w-64"
            />
          </div>
          {tabRows.length === 0 ? (
            <div className="card p-8 text-center text-sm text-gray-500">
              {term ? `No confirmations match “${q}”.` : 'Nothing here right now.'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tabRows.map((r) => (
                <CallCard key={r.id} r={r} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-8">
          {ORDER.map((state) => {
            const list = byState[state];
            if (list.length === 0) return null;
            const capped = list.slice(0, STACK_CAP);
            return (
              <section key={state}>
                <div className="mb-2 flex items-baseline gap-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700">{STATE_META[state].heading}</h2>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 tabular-nums">{list.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {capped.map((r) => (
                    <CallCard key={r.id} r={r} />
                  ))}
                </div>
                {list.length > capped.length && (
                  <div className="mt-2 text-right text-sm">
                    <button type="button" onClick={() => { setView('tabs'); setTab(state); }} className="text-brand-700 hover:underline">
                      See all {list.length} →
                    </button>
                  </div>
                )}
              </section>
            );
          })}
          {rows.length === 0 && (
            <div className="card p-8 text-center text-sm text-gray-500">No confirmation calls outstanding. 🎉</div>
          )}
        </div>
      )}
    </div>
  );
}
