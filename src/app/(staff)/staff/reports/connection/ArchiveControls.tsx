'use client';

import { useState, useTransition } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { importJournalYearAction } from '../actions';
import type { ImportYearResult } from '@/lib/reporting/journalImport';

export interface YearArchiveRow {
  year: number;
  rows: number;
  matched: number;
  lastImportedAt: string | null; // ISO or null
  configured: boolean; // a sheet id is set for this year
}

function fmtWhen(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'never';
  return d.toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function YearRow({ row }: { row: YearArchiveRow }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportYearResult | null>(null);
  const archived = row.rows > 0;

  const run = () => {
    const msg = archived
      ? `Re-sync ${row.year} from Google Sheets? This replaces the ${row.rows.toLocaleString('en-CA')} archived rows with a fresh copy.`
      : `Upload ${row.year} into the database? Office customer search will then read this year straight from the DB.`;
    if (!window.confirm(msg)) return;
    setResult(null);
    start(async () => {
      const res = await importJournalYearAction(row.year);
      setResult(res);
    });
  };

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{row.year}</span>
          {archived ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 size={12} /> In database
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">Not uploaded</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-gray-500">
          {archived ? (
            <>
              {row.rows.toLocaleString('en-CA')} rows · {row.matched.toLocaleString('en-CA')} matched to an office · uploaded {fmtWhen(row.lastImportedAt)}
            </>
          ) : row.configured ? (
            'Not in the database yet — searches can’t see this year until it’s uploaded.'
          ) : (
            <span className="text-amber-700">No JOURNAL_SHEET_ID configured for this year.</span>
          )}
        </div>
        {result && (
          <div className={`mt-1 flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-700' : 'text-red-600'}`}>
            {result.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {result.ok
              ? `Done — ${result.rows.toLocaleString('en-CA')} rows (${result.matched.toLocaleString('en-CA')} matched).`
              : `Failed — ${result.error ?? 'unknown error'}`}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={run}
        disabled={pending || !row.configured}
        className="inline-flex flex-none items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
      >
        {pending ? (
          <>
            <RefreshCw size={13} className="animate-spin" /> Working…
          </>
        ) : archived ? (
          <>
            <RefreshCw size={13} /> Re-sync
          </>
        ) : (
          <>
            <Database size={13} /> Upload to DB
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Admin control to upload/re-sync each closed journal year into the Postgres
 * archive that office customer search reads. One shared importer backs this and
 * the CLI (scripts/import-journals.ts).
 */
export function ArchiveControls({ rows }: { rows: YearArchiveRow[] }) {
  if (rows.length === 0) {
    return <div className="px-5 py-4 text-sm text-gray-500">No closed years are configured to archive yet.</div>;
  }
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((r) => (
        <YearRow key={r.year} row={r} />
      ))}
    </div>
  );
}
