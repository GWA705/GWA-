'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { backfillJournalUnitsAction, type BackfillUnitsSummary } from '@/app/(staff)/actions';

/**
 * One-time maintenance: fill the journal UNITS column on existing rows the
 * portal already placed, using each deal's product count. Two steps — Preview
 * (a dry run that reads + plans but writes nothing), then Apply. It only ever
 * fills a BLANK UNITS cell and re-checks each row's Last Name, so it can never
 * overwrite a value or land on the wrong customer.
 */
export function BackfillUnitsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<BackfillUnitsSummary | null>(null);
  const [done, setDone] = useState<BackfillUnitsSummary | null>(null);

  function runPreview() {
    setDone(null);
    start(async () => {
      setPreview(await backfillJournalUnitsAction(false));
    });
  }

  function apply() {
    if (!preview) return;
    if (!window.confirm(
      `Write UNITS to ${preview.filled} journal row${preview.filled === 1 ? '' : 's'}? This only fills blank UNITS cells — it never changes anything else.`,
    )) return;
    start(async () => {
      const res = await backfillJournalUnitsAction(true);
      setDone(res);
      setPreview(null);
      router.refresh();
    });
  }

  const summary = done ?? preview;

  return (
    <div className="card p-6 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Back-fill journal UNITS</h2>
        <p className="mt-1 text-xs text-gray-500">
          One-time fill of the <strong>UNITS</strong> column (number of products) on existing journal rows the portal
          wrote. Only blank UNITS cells are filled, and each row&apos;s Last Name is re-checked first — nothing else on
          the sheet is touched. New deals already get UNITS written automatically.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runPreview}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95 disabled:opacity-60"
        >
          {pending && !done ? 'Checking…' : 'Preview'}
        </button>
        {preview && !done && preview.filled > 0 && (
          <button
            type="button"
            onClick={apply}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
          >
            {pending ? 'Writing…' : `Apply — fill ${preview.filled} row${preview.filled === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {summary && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
          {done && (
            <p className="text-sm font-semibold text-emerald-700">
              Done — wrote UNITS to {done.filled} row{done.filled === 1 ? '' : 's'}.
            </p>
          )}
          {!done && preview && (
            <p className="text-sm font-semibold text-gray-800">
              {preview.filled > 0
                ? `${preview.filled} row${preview.filled === 1 ? '' : 's'} would get a UNITS value. Nothing written yet — press Apply.`
                : 'Nothing to fill — every matching row already has a UNITS value.'}
            </p>
          )}
          <p>Portal deals on the journal: <strong>{summary.matched}</strong></p>
          {summary.skippedHadValue > 0 && <p>Left alone (UNITS already filled): {summary.skippedHadValue}</p>}
          {summary.skippedMismatch > 0 && <p>Skipped (row&apos;s name no longer matches): {summary.skippedMismatch}</p>}
          {summary.skippedNoColumn > 0 && <p>Skipped (tab has no UNITS column): {summary.skippedNoColumn}</p>}
          {summary.errors.map((e, i) => (
            <p key={i} className="text-red-600">{e}</p>
          ))}
          {summary.plan.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer select-none font-medium text-gray-700">
                Show {summary.plan.length} row{summary.plan.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
                {summary.plan.map((p, i) => (
                  <li key={i} className="tabular-nums">
                    {p.tab} · row {p.row} · {p.lastName} → <strong>{p.units}</strong>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
