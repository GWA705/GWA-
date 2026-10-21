'use client';

import { useTransition } from 'react';
import { logConfirmationAttemptAction, removeConfirmationAttemptAction } from '@/app/(staff)/actions';

/**
 * The confirmer flow's tap-to-log call attempts (Concept 1). Replaces the
 * hand-typed call dates ("10/06, 10/15- vm") with one-tap, time-stamped outcomes,
 * so attempts / reach-rate / days-to-confirm are captured as real data. Each tap
 * calls a server action that revalidates the page, so the list below reflects the
 * saved attempts (no local state to drift).
 */

export interface AttemptVM {
  id: string;
  outcome: string; // NO_ANSWER | LEFT_VM | BUSY | REACHED
  at: string; // formatted date + time
  by: string | null;
}

const OUTCOMES: Record<string, { label: string; dot: string; text?: string }> = {
  NO_ANSWER: { label: 'No answer', dot: 'bg-slate-400' },
  LEFT_VM: { label: 'Left VM', dot: 'bg-amber-500' },
  BUSY: { label: 'Busy', dot: 'bg-blue-600' },
  REACHED: { label: 'Reached', dot: 'bg-green-600', text: 'text-green-700 dark:text-green-300' },
};

// The tap buttons, in order.
const BUTTONS: { outcome: string; label: string; cls: string }[] = [
  { outcome: 'NO_ANSWER', label: 'No answer', cls: '' },
  { outcome: 'LEFT_VM', label: 'Left VM', cls: '' },
  { outcome: 'BUSY', label: 'Busy', cls: '' },
  { outcome: 'REACHED', label: '✓ Reached', cls: 'border-green-500 text-green-700 dark:text-green-300' },
];

export function CallAttemptLog({ applicationId, attempts }: { applicationId: string; attempts: AttemptVM[] }) {
  const [pending, start] = useTransition();
  const reached = attempts.some((a) => a.outcome === 'REACHED');

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Call attempts</span>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          <b className="text-gray-900 dark:text-slate-100">{attempts.length}</b> {attempts.length === 1 ? 'attempt' : 'attempts'}
          {reached && <span className="ml-2 font-semibold text-green-700 dark:text-green-300">· reached ✓</span>}
        </span>
      </div>

      {/* logged attempts */}
      <div className="flex flex-wrap gap-2">
        {attempts.length === 0 ? (
          <span className="text-xs italic text-gray-400 dark:text-slate-500">No attempts yet — tap an outcome below.</span>
        ) : (
          attempts.map((a) => {
            const o = OUTCOMES[a.outcome] ?? { label: a.outcome, dot: 'bg-gray-400' };
            return (
              <span key={a.id} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs dark:border-slate-600 dark:bg-slate-700">
                <span className={`h-2 w-2 rounded-full ${o.dot}`} />
                <span className={`font-semibold ${o.text ?? 'text-gray-700 dark:text-slate-200'}`}>{o.label}</span>
                <span className="text-gray-400 dark:text-slate-400">{a.at}</span>
                {a.by && <span className="text-gray-400 dark:text-slate-500">· {a.by}</span>}
                <button
                  type="button"
                  aria-label="Remove attempt"
                  disabled={pending}
                  onClick={() => start(() => removeConfirmationAttemptAction(a.id))}
                  className="ml-0.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* tap-to-log buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {BUTTONS.map((b) => (
          <button
            key={b.outcome}
            type="button"
            disabled={pending}
            onClick={() => start(() => logConfirmationAttemptAction(applicationId, b.outcome))}
            className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 ${b.cls}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
        Each tap is time-stamped and logged with your name. The call count updates automatically — no need to type dates.
      </p>
    </div>
  );
}
