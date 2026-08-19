'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { PhaseState } from '@/lib/reviewerFlow';

export interface PhaseView {
  id: string;
  index: number;
  title: string;
  sub: string;
  state: PhaseState;
  dealerLabel: string;
  summary?: string; // one-line recap shown when the phase is Done
  autoNote?: string; // "when you finish this, the status becomes…"
  body: ReactNode; // the section content; null for a pure waiting phase
  // Force this phase open + flag it even when it's already "done" — used when a
  // required field (a deal number) is still missing on an auto-approved deal.
  attention?: boolean;
}

const LAYOUT_KEY = 'gwa:reviewer-layout';

/**
 * The reviewer's deal workspace. The same seven phases render either as a guided
 * accordion (Flow) or a tab bar (Tabs); the reviewer picks and the choice sticks
 * across deals. Either way the phase the deal is actually in is the one that
 * opens first, and finished phases collapse to a summary — so the page follows
 * the job instead of stacking every section at once.
 */
export function ReviewerWorkspace({
  phases,
  comms,
  rail,
  dealerStatus,
  alert,
}: {
  phases: PhaseView[];
  comms: ReactNode; // notes + history, always available (not a phase)
  rail: ReactNode; // decision + snapshot, persistent on the right
  dealerStatus: string;
  // A prominent banner shown above everything (e.g. an approved deal still
  // missing its HD / loan number).
  alert?: { message: string; targetPhaseId?: string } | null;
}) {
  const [layout, setLayout] = useState<'flow' | 'tabs'>('flow');
  const attentionPhase = phases.find((p) => p.attention);
  const nowPhase = phases.find((p) => p.state === 'now') ?? phases[0];
  // Open the flagged phase first when something needs attention.
  const [activeTab, setActiveTab] = useState<string>(attentionPhase?.id ?? nowPhase?.id ?? 'comms');

  // Restore the reviewer's preferred layout on mount (client-only).
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LAYOUT_KEY) : null;
    if (saved === 'flow' || saved === 'tabs') setLayout(saved);
  }, []);

  function choose(next: 'flow' | 'tabs') {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* private mode — preference just won't persist */
    }
  }

  return (
    <div>
      {alert && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white" aria-hidden>!</span>
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Needs your attention before this deal moves on</p>
            <p className="mt-0.5">{alert.message}</p>
          </div>
        </div>
      )}
      {/* Layout toggle */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Dealer currently sees: <span className="font-semibold text-brand-700">{dealerStatus}</span>
        </p>
        <div className="inline-flex rounded-md ring-1 ring-inset ring-gray-300" role="tablist" aria-label="Layout">
          <button
            type="button"
            onClick={() => choose('flow')}
            className={`rounded-l-md px-3 py-1.5 text-xs font-medium transition ${
              layout === 'flow' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            aria-pressed={layout === 'flow'}
          >
            ⭢ Flow
          </button>
          <button
            type="button"
            onClick={() => choose('tabs')}
            className={`rounded-r-md px-3 py-1.5 text-xs font-medium transition ${
              layout === 'tabs' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            aria-pressed={layout === 'tabs'}
          >
            ▦ Tabs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="order-2 lg:order-1 lg:col-span-2">
          {layout === 'flow' ? (
            <FlowLayout phases={phases} comms={comms} />
          ) : (
            <TabsLayout phases={phases} comms={comms} activeTab={activeTab} setActiveTab={setActiveTab} />
          )}
        </div>
        <div className="order-1 space-y-6 lg:order-2">{rail}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Flow */

function PhasePip({ index, state }: { index: number; state: PhaseState }) {
  const cls =
    state === 'done'
      ? 'bg-green-100 text-green-700'
      : state === 'now'
        ? 'bg-brand-600 text-white'
        : 'bg-gray-100 text-gray-400 ring-1 ring-inset ring-gray-200';
  return (
    <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg text-xs font-bold ${cls}`}>
      {state === 'done' ? '✓' : index}
    </span>
  );
}

function PhaseTag({ state }: { state: PhaseState }) {
  if (state === 'done') return <span className="badge bg-green-100 text-green-800">Done</span>;
  if (state === 'now') return <span className="badge bg-brand-50 text-brand-700">You're here</span>;
  return <span className="badge bg-gray-100 text-gray-400">Upcoming</span>;
}

function FlowLayout({ phases, comms }: { phases: PhaseView[]; comms: ReactNode }) {
  return (
    <div className="space-y-3">
      {phases.map((p) => (
        <details
          key={p.id}
          open={p.state === 'now' || p.attention}
          className={`card overflow-hidden ${p.attention ? 'ring-2 ring-amber-400' : p.state === 'now' ? 'ring-brand-300' : ''}`}
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <PhasePip index={p.index} state={p.state} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900">{p.title}</div>
              <div className={`text-xs ${p.attention ? 'text-amber-700' : p.state === 'now' ? 'text-brand-700' : 'text-gray-400'}`}>
                {p.attention ? 'Missing a required deal number — add it here' : p.state === 'done' && p.summary ? p.summary : p.sub}
              </div>
            </div>
            {p.attention ? <span className="badge bg-amber-100 text-amber-800">Action needed</span> : <PhaseTag state={p.state} />}
            <svg className="chev flex-none text-gray-400" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="border-t border-gray-100 px-4 pb-5 pt-4">
            {p.body ?? <WaitingNote phase={p} />}
            {p.autoNote && <AutoNote text={p.autoNote} />}
          </div>
        </details>
      ))}

      <details className="card overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-400">✎</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900">Notes &amp; history</div>
            <div className="text-xs text-gray-400">Messages, internal notes and the full activity log</div>
          </div>
          <svg className="chev flex-none text-gray-400" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="border-t border-gray-100 px-4 pb-5 pt-4">{comms}</div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs */

function TabsLayout({
  phases,
  comms,
  activeTab,
  setActiveTab,
}: {
  phases: PhaseView[];
  comms: ReactNode;
  activeTab: string;
  setActiveTab: (id: string) => void;
}) {
  const tabs = [
    ...phases.map((p) => ({ id: p.id, index: p.index, title: p.title, state: p.state, attention: p.attention })),
    { id: 'comms', index: 0, title: 'Notes & history', state: 'todo' as PhaseState, attention: false },
  ];
  const active = phases.find((p) => p.id === activeTab);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-2 pt-2" role="tablist">
        {tabs.map((t) => {
          const on = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActiveTab(t.id)}
              className={`-mb-px rounded-t-md px-3 py-2 text-xs font-medium transition ${
                on
                  ? 'border border-b-0 border-gray-200 bg-white text-gray-900 shadow-[inset_0_-2px_0_theme(colors.brand.600)]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span
                className={`mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full align-middle text-[10px] font-bold ${
                  t.attention
                    ? 'bg-amber-500 text-white'
                    : t.state === 'done'
                      ? 'bg-green-100 text-green-700'
                      : t.state === 'now'
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                }`}
              >
                {t.attention ? '!' : t.id === 'comms' ? '✎' : t.state === 'done' ? '✓' : t.index}
              </span>
              {t.title}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {activeTab === 'comms' ? (
          comms
        ) : active ? (
          <>
            {active.state === 'now' && (
              <span className="badge mb-3 inline-flex bg-brand-50 text-brand-700">● You're on this step</span>
            )}
            <h2 className="mb-1 text-base font-semibold text-gray-900">{active.title}</h2>
            <p className="mb-4 text-xs text-gray-500">{active.sub}</p>
            {active.body ?? <WaitingNote phase={active} />}
            {active.autoNote && <AutoNote text={active.autoNote} />}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- shared */

function WaitingNote({ phase }: { phase: PhaseView }) {
  return (
    <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-500">
      Nothing to do here yet — {phase.sub.toLowerCase()}. The deal moves forward on its own when that happens.
    </p>
  );
}

function AutoNote({ text }: { text: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
      <span className="flex-none font-bold text-green-600">↳ auto</span>
      <span>{text}</span>
    </div>
  );
}
