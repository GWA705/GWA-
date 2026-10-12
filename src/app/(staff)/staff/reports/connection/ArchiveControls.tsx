'use client';

import { useState, useTransition } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertTriangle, Eye, ShieldAlert } from 'lucide-react';
import { importJournalYearAction, previewJournalYearAction } from '../actions';
import type { ImportYearResult, JournalPreview } from '@/lib/reporting/journalImport';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';

export interface YearArchiveRow {
  year: number;
  rows: number;
  matched: number;
  lastImportedAt: string | null; // ISO or null
  configured: boolean; // a sheet id is set for this year
}

function fmtWhen(iso: string | null, t: TFunction): string {
  if (!iso) return t('reportsUi.connection.never');
  const d = new Date(iso);
  if (isNaN(d.getTime())) return t('reportsUi.connection.never');
  return d.toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const n = (x: number) => x.toLocaleString('en-CA');

function PreviewPanel({ p, t }: { p: JournalPreview; t: TFunction }) {
  if (!p.ok) {
    return (
      <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
        <AlertTriangle size={13} /> {t('reportsUi.connection.previewFailed', { error: p.error ?? '' })}
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
      <div className="font-semibold text-gray-900">{t('reportsUi.connection.previewTitle', { year: p.year })}</div>
      <div className="mt-1">
        {t('reportsUi.connection.previewCounts', { rows: n(p.rows), matched: n(p.matched), unmatched: n(p.unmatched) })}
        {p.existingRows > 0 && <>{t('reportsUi.connection.previewExisting', { n: n(p.existingRows) })}</>}
      </div>
      <div className="mt-0.5">
        {t(p.tabsProcessed === 1 ? 'reportsUi.connection.tabsReadOne' : 'reportsUi.connection.tabsReadMany', { n: p.tabsProcessed })}
        {p.tabsSkipped.length > 0 && (
          <span className="text-amber-700">{t('reportsUi.connection.tabsSkipped', { n: p.tabsSkipped.length, tabs: p.tabsSkipped.map((s) => s.tab).join(', ') })}</span>
        )}
      </div>
      {p.totalIssues > 0 && (
        <div className="mt-1 text-amber-700">
          {t('reportsUi.connection.dataIssues', { n: n(p.totalIssues), issues: p.issues.slice(0, 4).map((i) => `${i.type.replace(/_/g, ' ')} (${i.count})`).join(', ') })}
          {p.issues.length > 4 && '…'}
        </div>
      )}
      {p.wouldShrink && (
        <div className="mt-1 flex items-center gap-1 font-semibold text-red-600">
          <ShieldAlert size={13} /> {t('reportsUi.connection.wouldShrink')}
        </div>
      )}
      {p.sample.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="pr-2 font-medium">{t('reportsUi.connection.colCustomer')}</th>
                <th className="pr-2 font-medium">{t('reportsUi.connection.colStore')}</th>
                <th className="pr-2 font-medium">{t('reportsUi.common.office')}</th>
                <th className="pr-2 font-medium">{t('reportsUi.connection.colProduct')}</th>
                <th className="pr-2 font-medium">{t('reportsUi.connection.colResult')}</th>
                <th className="pr-2 font-medium">{t('reportsUi.connection.colDate')}</th>
                <th className="font-medium">{t('reportsUi.connection.colGross')}</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {p.sample.map((s, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="pr-2">{s.customer}</td>
                  <td className="pr-2">{s.storeNumber ?? '—'}</td>
                  <td className="pr-2">{s.office ?? <span className="text-amber-600">{t('reportsUi.connection.unmatchedCell')}</span>}</td>
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

function YearRow({ row, t }: { row: YearArchiveRow; t: TFunction }) {
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
      ? t('reportsUi.connection.confirmForce', { year: row.year })
      : archived
        ? t('reportsUi.connection.confirmResync', { year: row.year, n: n(row.rows) })
        : t('reportsUi.connection.confirmUpload', { year: row.year });
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
                <CheckCircle2 size={12} /> {t('reportsUi.connection.inDatabase')}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{t('reportsUi.connection.notUploaded')}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {archived ? (
              <>{t('reportsUi.connection.archivedMeta', { rows: n(row.rows), matched: n(row.matched), when: fmtWhen(row.lastImportedAt, t) })}</>
            ) : row.configured ? (
              t('reportsUi.connection.notInDatabase')
            ) : (
              <span className="text-amber-700">{t('reportsUi.connection.noSheetId')}</span>
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
            <Eye size={13} /> {t('reportsUi.connection.preview')}
          </button>
          <button
            type="button"
            onClick={() => doImport(false)}
            disabled={pending || !row.configured}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            {pending ? (
              <><RefreshCw size={13} className="animate-spin" /> {t('reportsUi.connection.working')}</>
            ) : archived ? (
              <><RefreshCw size={13} /> {t('reportsUi.connection.resync')}</>
            ) : (
              <><Database size={13} /> {t('reportsUi.connection.uploadToDb')}</>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className={`mt-1.5 flex items-center gap-1 text-xs ${result.ok ? 'text-emerald-700' : result.blocked ? 'text-amber-700' : 'text-red-600'}`}>
          {result.ok ? <CheckCircle2 size={13} /> : result.blocked ? <ShieldAlert size={13} /> : <AlertTriangle size={13} />}
          {result.ok
            ? t('reportsUi.connection.resultDone', { rows: n(result.rows), matched: n(result.matched), issues: result.totalIssues > 0 ? t('reportsUi.connection.resultIssues', { n: n(result.totalIssues) }) : '' })
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
          <ShieldAlert size={13} /> {t('reportsUi.connection.forceReplace')}
        </button>
      )}

      {preview && <PreviewPanel p={preview} t={t} />}
    </div>
  );
}

/**
 * Admin control to preview, upload, and re-sync each closed journal year into the
 * Postgres archive that office customer search reads. One shared importer backs
 * this and the CLI (scripts/import-journals.ts).
 */
export function ArchiveControls({ rows }: { rows: YearArchiveRow[] }) {
  const t = useT();
  if (rows.length === 0) {
    return <div className="px-5 py-4 text-sm text-gray-500">{t('reportsUi.connection.noClosedYears')}</div>;
  }
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((r) => (
        <YearRow key={r.year} row={r} t={t} />
      ))}
    </div>
  );
}
