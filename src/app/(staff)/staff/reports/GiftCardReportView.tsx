'use client';

import { useMemo, useState } from 'react';
import type { GiftCardReport, GiftCardRow } from '@/lib/reporting/giftCardReport';
import { ReportTile } from '@/components/reporting/kit';
import { useT } from '@/i18n/client';

const money = (n: number) =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

type SortKey = 'dealer' | 'sentCount' | 'sentTotal' | 'pendingCount' | 'pendingTotal' | 'cancelledCount' | 'lastSentAt';

const NUMERIC: Record<SortKey, boolean> = {
  dealer: false,
  sentCount: true,
  sentTotal: true,
  pendingCount: true,
  pendingTotal: true,
  cancelledCount: true,
  lastSentAt: true,
};

const COLUMNS: { key: SortKey; labelKey: string; align: 'left' | 'right' }[] = [
  { key: 'dealer', labelKey: 'reportsUi.common.office', align: 'left' },
  { key: 'sentCount', labelKey: 'reportsUi.giftCards.colCardsSent', align: 'right' },
  { key: 'sentTotal', labelKey: 'reportsUi.giftCards.colSent', align: 'right' },
  { key: 'pendingCount', labelKey: 'reportsUi.giftCards.colPending', align: 'right' },
  { key: 'pendingTotal', labelKey: 'reportsUi.giftCards.colPendingDollars', align: 'right' },
  { key: 'cancelledCount', labelKey: 'reportsUi.giftCards.colCancelled', align: 'right' },
  { key: 'lastSentAt', labelKey: 'reportsUi.giftCards.colLastSent', align: 'right' },
];

/**
 * Gift-card report by office: cards sent + $ per dealer, plus what's pending.
 * Sortable (click any column header) and downloadable as CSV. Admin-only.
 */
export function GiftCardReportView({ report }: { report: GiftCardReport }) {
  const t = useT();
  const { rows, totals, generatedAt } = report;
  const [sortKey, setSortKey] = useState<SortKey>('sentTotal');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === 'dealer') {
        cmp = a.dealer.localeCompare(b.dealer);
      } else if (sortKey === 'lastSentAt') {
        cmp = (a.lastSentAt ?? '').localeCompare(b.lastSentAt ?? '');
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, dir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDir(NUMERIC[key] ? 'desc' : 'asc');
    }
  };

  const downloadCsv = () => {
    const header = [
      t('reportsUi.common.office'),
      t('reportsUi.giftCards.colCardsSent'),
      t('reportsUi.giftCards.colSent'),
      t('reportsUi.giftCards.colPending'),
      t('reportsUi.giftCards.colPendingDollars'),
      t('reportsUi.giftCards.colCancelled'),
      t('reportsUi.giftCards.colLastSent'),
    ];
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.map(esc).join(',')];
    for (const r of sorted) {
      lines.push(
        [r.dealer, r.sentCount, r.sentTotal.toFixed(2), r.pendingCount, r.pendingTotal.toFixed(2), r.cancelledCount, r.lastSentAt ? r.lastSentAt.slice(0, 10) : '']
          .map(esc)
          .join(','),
      );
    }
    lines.push(
      [t('reportsUi.giftCards.totalUpper'), totals.sentCount, totals.sentTotal.toFixed(2), totals.pendingCount, totals.pendingTotal.toFixed(2), totals.cancelledCount, '']
        .map(esc)
        .join(','),
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gift-cards-by-office-${generatedAt.slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const arrow = (key: SortKey) => (key === sortKey ? (dir === 'asc' ? ' ▲' : ' ▼') : '');
  const generated = new Date(generatedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  const tile = (label: string, value: string, sub?: string) => <ReportTile label={label} value={value} sub={sub} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-gray-800 pb-3">
        <div className="min-w-0">
          <div className="text-sm font-bold uppercase tracking-wide text-gray-500">Georgian Water &amp; Air</div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reportsUi.giftCards.heading')}</h1>
          <p className="mt-0.5 text-sm text-gray-600">{t('reportsUi.giftCards.subtitle')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button type="button" onClick={downloadCsv} className="btn-secondary text-sm">{t('reportsUi.giftCards.downloadCsv')}</button>
          <div className="text-right text-xs text-gray-400">{t('reportsUi.common.generated', { date: generated })}</div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile(t('reportsUi.giftCards.colCardsSent'), totals.sentCount.toLocaleString('en-CA'), t(rows.length === 1 ? 'reportsUi.giftCards.officeOne' : 'reportsUi.giftCards.officeMany', { n: rows.length }))}
        {tile(t('reportsUi.giftCards.tileTotalSent'), money(totals.sentTotal))}
        {tile(t('reportsUi.giftCards.colPending'), totals.pendingCount.toLocaleString('en-CA'), totals.pendingTotal > 0 ? t('reportsUi.giftCards.queued', { amount: money0(totals.pendingTotal) }) : undefined)}
        {tile(t('reportsUi.giftCards.colCancelled'), totals.cancelledCount.toLocaleString('en-CA'))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          {t('reportsUi.giftCards.noRequests')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-100 text-[11px] uppercase tracking-wide text-gray-600">
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={`cursor-pointer select-none px-4 py-3 ${c.align === 'right' ? 'text-right' : 'text-left'} hover:text-gray-900`}
                    onClick={() => onSort(c.key)}
                  >
                    {t(c.labelKey)}{arrow(c.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((r: GiftCardRow, i) => (
                <tr key={r.dealerId} className={i % 2 ? 'bg-gray-50/40' : ''}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.dealer}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{r.sentCount || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{r.sentTotal ? money(r.sentTotal) : '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{r.pendingCount || '—'}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${r.pendingTotal ? 'text-amber-700' : 'text-gray-300'}`}>{r.pendingTotal ? money(r.pendingTotal) : '—'}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${r.cancelledCount ? 'text-gray-600' : 'text-gray-300'}`}>{r.cancelledCount || '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{fmtDate(r.lastSentAt)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-100">
                <td className="px-4 py-3 font-bold text-gray-800">{t('reportsUi.common.total')}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800">{totals.sentCount}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">{money(totals.sentTotal)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800">{totals.pendingCount}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800">{totals.pendingTotal ? money(totals.pendingTotal) : '—'}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800">{totals.cancelledCount}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        {t('reportsUi.giftCards.footnote')}
      </p>
    </div>
  );
}
