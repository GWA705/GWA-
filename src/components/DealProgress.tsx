import type { ReactNode } from 'react';
import type { ApplicationStatus } from '@prisma/client';
import {
  dealProgress,
  offPathFlag,
  progressPercent,
  currentStageIndex,
  type ProgressSignals,
  type ProgressStage,
} from '@/lib/progress';

// Per-stage completion dates (formatted), keyed by ProgressStage.key. Optional —
// only the reviewer timeline shows them; the dealer bar doesn't need them.
export type StageDates = Partial<Record<string, string | null>>;

interface DealProgressProps extends ProgressSignals {
  // 'bar' = segmented progress (dealer view). 'timeline' = milestone timeline
  // with icons + a live detail strip (reviewer view). Defaults to 'bar'.
  variant?: 'bar' | 'timeline';
  stageDates?: StageDates;
}

// Short "what's happening now" line for the reviewer timeline's detail strip.
const STAGE_NOTE: Partial<Record<ApplicationStatus, string>> = {
  SUBMITTED: 'A reviewer will pick this up shortly.',
  UNDER_REVIEW: 'A reviewer is checking the application now.',
  CONDITIONAL: 'Conditionally approved — a few documents still needed.',
  APPROVED: 'Approved — install paperwork is being prepared.',
  DOCS_SENT: 'Install paperwork sent — waiting on the signed package back.',
  FUNDING_SUBMITTED: 'Signed package received — being checked before funding.',
  FUNDING_REVIEW: 'Sent to the finance company — waiting on the funding decision.',
  FUNDED: 'Funded — record the dealer payout to finish.',
};

// Statuses that move forward on their own (a wait), vs. ones needing a staff step.
const AUTO_ADVANCE: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW'];

const ICONS: Record<string, ReactNode> = {
  submitted: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  approved: <><path d="M9 12l2 2 4-4" /><path d="M12 3l2.5 1.7 3 .1 1 2.8 2.2 2-1 2.8 1 2.8-2.2 2-1 2.8-3 .1L12 21l-2.5-1.7-3-.1-1-2.8-2.2-2 1-2.8-1-2.8 2.2-2 1-2.8 3-.1z" /></>,
  docs: <><path d="M14 3v5h5" /><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /></>,
  confirmation: <path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 1-2Z" />,
  funding: <><path d="M3 21h18M4 10h16M5 10 12 4l7 6M6 10v8M10 10v8M14 10v8M18 10v8" /></>,
  funded: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 2.5-1.5c1.4 0 2.5.7 2.5 1.8 0 2.4-5 1.3-5 3.6 0 1.1 1.1 1.8 2.5 1.8a2.6 2 0 0 0 2.5-1.4" /></>,
  paid: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
};

function StageIcon({ stageKey }: { stageKey: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[stageKey] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

function FlagRow({ flag }: { flag: { label: string; cls: string } }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm">
      <span className={`badge ${flag.cls}`}>{flag.label}</span>
      <span className="text-gray-500">This deal is currently off the normal track.</span>
    </div>
  );
}

export function DealProgress(props: DealProgressProps) {
  const { variant = 'bar', stageDates } = props;
  const stages = dealProgress(props);
  const flag = offPathFlag(props.status);
  const current = currentStageIndex(stages); // -1 when every stage is done
  const pct = progressPercent(stages);

  if (variant === 'timeline') {
    return (
      <section className="card p-5">
        {flag && <FlagRow flag={flag} />}
        <div className="flex items-start">
          {stages.map((st, i) => {
            const state: 'done' | 'now' | 'todo' = st.done ? 'done' : i === current ? 'now' : 'todo';
            const leftOn = i > 0 && stages[i - 1].done;
            const rightOn = st.done;
            const circle =
              state === 'done'
                ? 'bg-brand-600 text-white'
                : state === 'now'
                  ? 'border-[3px] border-brand-600 bg-brand-50 text-brand-700 gwa-pulse-ring'
                  : 'border-2 border-gray-200 bg-gray-50 text-gray-400';
            const date = state === 'now' ? 'Now' : state === 'done' ? stageDates?.[st.key] ?? null : null;
            return (
              <div key={st.key} className="flex min-w-0 flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <div className={`h-[3px] flex-1 ${i === 0 ? 'opacity-0' : leftOn ? 'bg-brand-600' : 'bg-gray-200'}`} />
                  <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${circle}`}>
                    <StageIcon stageKey={st.key} />
                  </div>
                  <div className={`h-[3px] flex-1 ${i === stages.length - 1 ? 'opacity-0' : rightOn ? 'bg-brand-600' : 'bg-gray-200'}`} />
                </div>
                <span className={`mt-2 px-0.5 text-center text-[11px] leading-tight sm:text-xs ${state === 'now' ? 'font-bold text-brand-700' : state === 'done' ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
                  {st.label}
                </span>
                <span className={`text-[10.5px] ${state === 'now' ? 'font-semibold text-brand-600' : 'text-gray-400'}`}>{date ?? ' '}</span>
              </div>
            );
          })}
        </div>

        {!flag && current !== -1 && (
          <div className="mt-5 flex items-center gap-3 rounded-r-xl border-l-4 border-brand-600 bg-brand-50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-gray-900">
                {stages[current].label} <span className="font-medium text-gray-500">· step {current + 1} of {stages.length}</span>
              </div>
              <div className="mt-0.5 text-[13px] text-gray-600">{STAGE_NOTE[props.status] ?? 'In progress.'}</div>
            </div>
            {AUTO_ADVANCE.includes(props.status) && (
              <span className="flex-none rounded-full bg-brand-100 px-3 py-1 text-[11px] font-bold text-brand-700">Auto-advances</span>
            )}
          </div>
        )}
        {!flag && current === -1 && (
          <div className="mt-5 rounded-r-xl border-l-4 border-green-500 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            Deal complete — all steps done.
          </div>
        )}
      </section>
    );
  }

  // 'bar' — segmented progress (dealer view).
  return (
    <section className="card p-5">
      {flag && <FlagRow flag={flag} />}
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Current stage</div>
          <div className="truncate text-lg font-bold text-gray-900">{current === -1 ? 'Complete' : stages[current].label}</div>
        </div>
        <div className="flex-none text-right">
          <div className="text-2xl font-extrabold leading-none text-brand-700">{pct}%</div>
          <div className="mt-1 text-[11px] text-gray-400">{current === -1 ? 'All steps done' : `Step ${current + 1} of ${stages.length}`}</div>
        </div>
      </div>

      <div className="flex gap-1.5">
        {stages.map((st, i) => {
          if (st.done) return <div key={st.key} className="h-3 flex-1 rounded-full bg-brand-600" />;
          if (i === current) {
            return (
              <div key={st.key} className="relative h-3 flex-1 overflow-hidden rounded-full bg-brand-100">
                <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-brand-600" />
                <div className="gwa-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              </div>
            );
          }
          return <div key={st.key} className="h-3 flex-1 rounded-full bg-gray-200" />;
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {stages.map((st, i) => (
          <span
            key={st.key}
            className={`flex-1 text-center text-[11px] leading-tight ${st.done ? 'font-semibold text-gray-800' : i === current ? 'font-bold text-brand-700' : 'text-gray-400'}`}
          >
            {st.label}
          </span>
        ))}
      </div>
    </section>
  );
}
