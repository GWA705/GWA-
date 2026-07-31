'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

// A pre-formatted deal row (all display fields computed on the server).
export type Tone = 'new' | 'review' | 'appr' | 'fund' | 'funded' | 'paid' | 'prob' | 'decl' | 'note';
export interface QueueRow {
  id: string;
  applicant: string;
  dealer: string;
  program: string;
  amount: string;
  statusLabel: string;
  tone: Tone;
  paid: boolean;
  activityLabel: string | null;
  activityTone: Tone | null;
  waitLabel: string;
  waitHot: boolean;
  dateLabel: string;
}

export interface Lanes {
  needsApproval: QueueRow[];
  updates: QueueRow[];
  inFunding: QueueRow[];
  all: QueueRow[];
}

const TONE_CLASS: Record<Tone, string> = {
  new: 'bg-blue-100 text-blue-800',
  review: 'bg-sky-100 text-sky-800',
  appr: 'bg-green-100 text-green-800',
  fund: 'bg-indigo-100 text-indigo-800',
  funded: 'bg-sky-100 text-sky-800',
  paid: 'bg-emerald-100 text-emerald-800',
  prob: 'bg-red-100 text-red-800',
  decl: 'bg-gray-100 text-gray-600',
  note: 'bg-amber-100 text-amber-800',
};

function Pill({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`badge ${TONE_CLASS[tone]}`}>{label}</span>;
}

type Kind = 'approve' | 'updates' | 'funding' | 'all';
const PAGE_SIZES = [10, 25, 50, 100];

export function DealTable({ rows, kind }: { rows: QueueRow[]; kind: Kind }) {
  const showActivity = kind === 'updates';
  const showDate = kind === 'all';
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="w-1 p-0" />
            <th className="px-4 py-3">Applicant</th>
            <th className="px-4 py-3">Dealer</th>
            {showActivity ? <th className="px-4 py-3">What changed</th> : <th className="px-4 py-3">Program</th>}
            {!showActivity && !showDate && <th className="px-4 py-3">Amount</th>}
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">{showDate ? 'Date' : 'Waiting'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((a) => (
            <tr key={a.id} className={a.waitHot ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50'}>
              <td className="w-1 p-0"><div className={`h-full w-1 ${a.waitHot ? 'bg-red-500' : 'bg-transparent'}`} /></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link href={`/staff/applications/${a.id}`} className="font-medium text-brand-700 hover:underline">{a.applicant}</Link>
                  {a.paid && <span className="badge bg-emerald-100 text-emerald-800">Paid</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{a.dealer}</td>
              {showActivity ? (
                <td className="px-4 py-3">{a.activityLabel && a.activityTone ? <Pill tone={a.activityTone} label={a.activityLabel} /> : <span className="text-gray-300">—</span>}</td>
              ) : (
                <td className="px-4 py-3">{a.program}</td>
              )}
              {!showActivity && !showDate && <td className="px-4 py-3 tabular-nums">{a.amount}</td>}
              <td className="px-4 py-3"><Pill tone={a.tone} label={a.statusLabel} /></td>
              <td className={`px-4 py-3 tabular-nums ${a.waitHot ? 'font-semibold text-red-700' : 'text-gray-500'}`}>
                {showDate ? a.dateLabel : a.waitLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS: { key: Kind; label: string; hint: string }[] = [
  { key: 'approve', label: 'Needs approval', hint: 'Brand-new deals waiting for a decision. Approving these is the priority.' },
  { key: 'updates', label: 'Updates', hint: 'Deals you already handled where the dealer just sent something new.' },
  { key: 'funding', label: 'In funding', hint: "Approved deals moving toward payment. They live here until they're paid." },
  { key: 'all', label: 'All deals', hint: 'Everything, for search and history — paid, declined, and older deals included.' },
];

function rowsFor(lanes: Lanes, kind: Kind): QueueRow[] {
  if (kind === 'approve') return lanes.needsApproval;
  if (kind === 'updates') return lanes.updates;
  if (kind === 'funding') return lanes.inFunding;
  return lanes.all;
}

export function ReviewerQueue({ lanes }: { lanes: Lanes }) {
  const [view, setView] = useState<'tabs' | 'stacked'>('tabs');
  const [tab, setTab] = useState<Kind>('approve');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Remember each reviewer's layout choice.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('reviewerView') : null;
    if (saved === 'tabs' || saved === 'stacked') setView(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('reviewerView', view);
  }, [view]);
  useEffect(() => setPage(1), [tab, perPage]);

  const counts = {
    approve: lanes.needsApproval.length,
    updates: lanes.updates.length,
    funding: lanes.inFunding.length,
    all: lanes.all.length,
  };

  const activeRows = rowsFor(lanes, tab);
  const pageCount = Math.max(1, Math.ceil(activeRows.length / perPage));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => activeRows.slice((safePage - 1) * perPage, safePage * perPage),
    [activeRows, safePage, perPage],
  );
  const first = activeRows.length === 0 ? 0 : (safePage - 1) * perPage + 1;
  const last = Math.min(safePage * perPage, activeRows.length);

  return (
    <div>
      {/* Layout toggle */}
      <div className="mb-5 flex items-center gap-2 text-sm">
        <span className="text-gray-400">View</span>
        <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-gray-200">
          {(['tabs', 'stacked'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-3.5 py-1 text-sm font-medium ${view === v ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {v === 'tabs' ? 'Tabs' : 'Stacked lanes'}
            </button>
          ))}
        </div>
      </div>

      {view === 'tabs' ? (
        <>
          <div className="mb-1 flex flex-wrap gap-1 border-b border-gray-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold ${tab === t.key ? 'text-brand-800' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-xs font-bold ${tab === t.key ? (t.key === 'approve' ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-800') : 'bg-gray-100 text-gray-500'}`}>{counts[t.key]}</span>
                {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-brand-600" />}
              </button>
            ))}
          </div>
          <p className="mb-3 mt-3 text-xs text-gray-400">{TABS.find((t) => t.key === tab)!.hint}</p>

          {activeRows.length === 0 ? (
            <div className="card p-8 text-center text-sm text-gray-500">
              {tab === 'approve' ? 'No deals waiting for approval. 🎉' : 'Nothing here right now.'}
            </div>
          ) : (
            <>
              <DealTable rows={paged} kind={tab} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  {PAGE_SIZES.map((n) => (
                    <button key={n} type="button" onClick={() => setPerPage(n)} className={`rounded px-2 py-1 ${n === perPage ? 'bg-brand-100 font-semibold text-brand-800' : 'hover:bg-gray-100'}`}>{n}</button>
                  ))}
                  <span>per page</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>{first}–{last} of {activeRows.length}</span>
                  {pageCount > 1 && (
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="rounded border border-gray-200 px-2 py-1 enabled:hover:bg-gray-50 disabled:text-gray-300">← Prev</button>
                      <span>Page {safePage} of {pageCount}</span>
                      <button type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} className="rounded border border-gray-200 px-2 py-1 enabled:hover:bg-gray-50 disabled:text-gray-300">Next →</button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-8">
          {TABS.map((t) => {
            const rows = rowsFor(lanes, t.key);
            const capped = rows.slice(0, 10);
            return (
              <section key={t.key}>
                <div className="mb-2 flex items-baseline gap-2.5">
                  <h2 className={`text-xs font-semibold uppercase tracking-wide ${t.key === 'approve' ? 'text-brand-800' : 'text-gray-700'}`}>{t.label}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.key === 'approve' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{counts[t.key]}</span>
                  <span className="ml-auto text-xs text-gray-400">{t.hint}</span>
                </div>
                {rows.length === 0 ? (
                  <div className="card p-6 text-center text-sm text-gray-500">Nothing here right now.</div>
                ) : (
                  <>
                    <DealTable rows={capped} kind={t.key} />
                    {rows.length > capped.length && (
                      <div className="mt-2 text-right text-sm">
                        <button type="button" onClick={() => { setView('tabs'); setTab(t.key); }} className="text-brand-700 hover:underline">
                          See all {rows.length} →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
