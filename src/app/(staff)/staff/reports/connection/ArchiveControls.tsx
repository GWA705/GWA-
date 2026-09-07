'use client';

import { useState, useTransition } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertTriangle, Eye, ShieldAlert } from 'lucide-react';
import { importJournalYearAction, previewJournalYearAction } from '../actions';
import type { ImportYearResult, JournalPreview } from '@/lib/reporting/journalImport';

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

const n = (x: number) => x.toLocaleString('en-CA');

function PreviewPanel({ p }: { p: JournalPreview }) {
  if (!p.ok) {
    return (
      <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
        <AlertTriangle size={13} /> Preview failed — {p.error}
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
      <div className="font-semibold text-gray-900">Preview {p.year} (nothing written yet)</div>
      <div className="mt-1">
        {n(p.rows)} rows parsed · {n(p.matched)} matched to an office · {n(p.unmatched)} unmatched
        {p.existingRows > 0 && <> · {n(p.existingRows)} currently archived</>}
      </div>
      <div className="mt-0.5">
        {p.tabsProcessed} month tab{p.tabsProcessed === 1 ? '' : 's'} read
        {p.tabsSkipped.length > 0 && (
          <span className="text-amber-700"> · {p.tabsSkipped.length} tab(s) skipped: {p.tabsSkipped.map((s) => s.tab).join(', ')}</span>
        )}
      </div>
      {p.totalIssues > 0 && (
        <div className="mt-1 text-amber-700">
          {n(p.totalIssues)} data issue(s): {p.issues.slice(0, 4).map((i) => `${i.type.replace(/_/g, ' ')} (${i.count})`).join(', ')}
          {p.issues.length > 4 && '…'}
        </div>
      )}
      {p.wouldShrink && (
        <div className="mt-1 flex items-center gap-1 font-semibold text-red-600">
          <ShieldAlert size={13} /> This is far smaller than what’s archived — check the parse before forcing an overwrite.
        </div>
      )}
      {p.sample.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="pr-2 font-medium">Customer</th>
                <th className="pr-2 font-medium">Store</th>
                <th className="pr-2 font-medium">Office</th>
                <th className="pr-2 font-medium">Product</th>
                <th className="pr-2 font-medium">Result</th>
                <th className="pr-2 font-medium">Date</th>
                <th className="font-medium">Gross</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {p.sample.map((s, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="pr-2">{s.customer}</td>
                  <td className="pr-2">{s.storeNumber ?? '—'}</td>
                  <td className="pr-2">{s.office ?? <span className="text-amber-600">unmatched</span>}</td>
                  <td className="pr-2">{s.product || '—'}</td>
                  <td className="pr-2">{s.result || '—'}</td>
                  <td className="pr-2">{s.saleDate || '—'}</td>
                  <td>{s.gross != null ? `$${n(Math.round(s.gross))}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function YearRow({ row }: { row: YearArchiveRow }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportYearResult | null>(null);
  const [preview, setPreview] = useState<JournalPreview | null>(null);
  const archived = row.rows > 0;

  const doPreview = () => {
    setResult(null);
    start(async () => setPreview(await previewJournalYearAction(row.year)));
  };

  const doImport = (force: boolean) => {
    const msg = force
      ? `Force-replace ${row.year}? This overwrites the archive even though the safety check flagged it. Only do this if the preview looked correct.`
      : archived
        ? `Re-sync ${row.year} from Google Sheets? This replaces the ${n(row.rows)} archived rows with a fresh copy.`
        : `Upload ${row.year} into the database? Office customer search will then read this year straight from the DB.`;
    if (!window.confirm(msg)) return;
    start(async () => {
      const res = await importJournalYearAction(row.year, force);
      setResult(res);
      if (res.ok) setPreview(null);
    });
  };

  return (
    <div className="px-5 py-3">
      <div className="flex items-start justify-between gap-4">
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
              <>{n(row.rows)} rows · {n(row.matched)} matched to an office · uploaded {fmtWhen(row.lastImportedAt)}</>
            ) : row.configured ? (
              'Not in the database yet — searches can’t see this year until it’s uploaded.'
            ) : (
              <span className="text-amber-700">No JOURNAL_SHEET_ID configured for this year.</span>
            )}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={doPreview}
            disabled={pending || !row.configured}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            <Eye size={13} /> Preview
          </button>
          <button
            type="button"
            onClick={() => doImport(false)}
            disabled={pending || !row.configured}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            {pending ? (
              <><RefreshCw size={13} className="animate-spin" /> Working…</>
            ) : archived ? (
              <><RefreshCw size={13} /> Re-sync</>
            ) : (
              <><Database size={13} /> Upload to DB</>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className={`mt-1.5 flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-700' : result.blocked ? 'text-amber-700' : 'text-red-600'}`}>
          {result.ok ? <CheckCircle2 size={13} /> : result.blocked ? <ShieldAlert size={13} /> : <AlertTriangle size={13} />}
          {result.ok
            ? `Done — ${n(result.rows)} rows (${n(result.matched)} matched${result.totalIssues > 0 ? `, ${n(result.totalIssues)} data issues` : ''}).`
            : result.error}
        </div>
      )}
      {result?.blocked && (
        <button
          type="button"
          onClick={() => doImport(true)}
          disabled={pending}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
        >
          <ShieldAlert size={13} /> Force replace anyway
        </button>
      )}

      {preview && <PreviewPanel p={preview} />}
    </div>
  );
}

/**
 * Admin control to preview, upload, and re-sync each closed journal year into the
 * Postgres archive that office customer search reads. One shared importer backs
 * this and the CLI (scripts/import-journals.ts).
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
