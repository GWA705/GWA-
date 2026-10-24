import 'server-only';
import { readJournal, type ReportDeal } from './journalRead';
import { reportStoreScope } from './monthly';
import { loadDealerMatchIndex } from './dealerMatch';
import { loadStoreCanon } from './storeCanon';

/**
 * Custom-range office report. Pick an office (or All offices) and a start→end
 * month span, and get how much money that office put through over the span,
 * broken down by month and by store (for one office) or by office (for the
 * all-offices aggregate).
 *
 * Money basis = OK money dated by DATE PAID (paid receivable) — the same basis
 * as the Monthly office report, so the two always reconcile.
 */

export interface RangeMonth {
  ym: string; // 'YYYY-MM'
  label: string; // 'Jan 2026'
}

export interface RangeRow {
  key: string; // store number, or dealerId (all-offices)
  label: string; // 'Barrie — 7024' or the office name
  total: number;
  count: number;
  byMonth: Record<string, number>; // ym → paid gross
}

export interface OfficeRangeReport {
  scopeLabel: string;
  isAll: boolean;
  groupBy: 'store' | 'office';
  startYm: string;
  endYm: string;
  rangeLabel: string;
  months: RangeMonth[];
  rows: RangeRow[]; // sorted by total desc
  monthTotals: Record<string, number>; // ym → total across all rows
  grandTotal: number;
  grandCount: number;
  configured: boolean;
  error?: string;
}

function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseYm(ym: string): { year: number; monthIndex: number } {
  const [y, m] = ym.split('-');
  return { year: parseInt(y, 10), monthIndex: parseInt(m, 10) - 1 };
}

/** All 'YYYY-MM' months from start to end inclusive, chronological. */
function monthsBetween(startYm: string, endYm: string): RangeMonth[] {
  const s = parseYm(startYm);
  const e = parseYm(endYm);
  const out: RangeMonth[] = [];
  const d = new Date(s.year, s.monthIndex, 1);
  const end = new Date(e.year, e.monthIndex, 1);
  // Guard against an inverted or runaway range (cap at 60 months).
  for (let i = 0; i < 60 && d <= end; i += 1) {
    out.push({
      ym: ymOf(d),
      label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
    });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function deriveStoreName(hdStoreRaw: string): string {
  const stripped = (hdStoreRaw || '')
    .replace(/\d{3,}/g, '')
    .replace(/[-–—#]/g, ' ')
    .replace(/\bstore\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';
  return stripped
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export async function buildOfficeRangeReport(
  dealerId: string,
  startYm: string,
  endYm: string,
): Promise<OfficeRangeReport> {
  // Normalise so start is never after end.
  let s = parseYm(startYm);
  let e = parseYm(endYm);
  if (new Date(s.year, s.monthIndex, 1) > new Date(e.year, e.monthIndex, 1)) {
    [s, e] = [e, s];
  }
  const normStartYm = `${s.year}-${String(s.monthIndex + 1).padStart(2, '0')}`;
  const normEndYm = `${e.year}-${String(e.monthIndex + 1).padStart(2, '0')}`;

  const scope = await reportStoreScope(dealerId);
  const isAll = scope.isAll;
  const groupBy: 'store' | 'office' = isAll ? 'office' : 'store';

  const months = monthsBetween(normStartYm, normEndYm);
  const monthSet = new Set(months.map((m) => m.ym));

  // Read every journal year the range touches.
  const years: number[] = [];
  for (let y = s.year; y <= e.year; y += 1) years.push(y);
  const [reads, index, canon] = await Promise.all([
    Promise.all(years.map((y) => readJournal(y))),
    loadDealerMatchIndex(),
    loadStoreCanon(),
  ]);
  const configured = reads.length > 0 ? reads[0].configured : false;
  const error = reads.find((r) => r.error)?.error;
  const deals: ReportDeal[] = reads.flatMap((r) => r.deals);

  const rowByKey = new Map<string, RangeRow>();
  const monthTotals: Record<string, number> = {};
  for (const m of months) monthTotals[m.ym] = 0;

  // Attribution is by the journal's Dealer column (store number only as a
  // fallback), so a shared store splits between the offices that sold there.
  const inScope = (d: ReportDeal): boolean => {
    if (isAll) return true;
    return index.matchDeal(d) === dealerId;
  };

  for (const d of deals) {
    if (d.result !== 'OK' || !d.datePaid) continue;
    const ym = ymOf(d.datePaid);
    if (!monthSet.has(ym)) continue;
    if (!inScope(d)) continue;

    let key: string;
    let label: string;
    if (groupBy === 'office') {
      const dealerMatch = index.matchDeal(d);
      key = dealerMatch ?? 'unassigned';
      label = dealerMatch ? index.nameById.get(dealerMatch) ?? dealerMatch : 'Unassigned (no office match)';
    } else {
      // Roll a mistyped store number into the real store (see storeCanon.ts) so
      // one store isn't split across phantom numbers.
      const canonNum = canon.canonical(d.storeNumber, d.hdStore);
      const store = canonNum || d.hdStore || 'Unknown';
      key = store;
      if (canonNum) {
        label = canon.labelFor(canonNum);
      } else {
        const nm = deriveStoreName(d.hdStore);
        label = nm ? `${store} — ${nm}` : store;
      }
    }

    let row = rowByKey.get(key);
    if (!row) {
      row = { key, label, total: 0, count: 0, byMonth: {} };
      rowByKey.set(key, row);
    }
    row.total += d.gross;
    row.count += 1;
    row.byMonth[ym] = (row.byMonth[ym] ?? 0) + d.gross;
    monthTotals[ym] += d.gross;
  }

  // For a single office, seed every known store so a zero-month store still
  // shows (matches the Monthly report's "dead stores show too").
  if (!isAll && scope.office) {
    for (const num of scope.office.storeNumbers) {
      if (!rowByKey.has(num)) {
        rowByKey.set(num, { key: num, label: canon.labelFor(num), total: 0, count: 0, byMonth: {} });
      }
    }
  }

  const rows = Array.from(rowByKey.values()).sort((a, b) => b.total - a.total);
  const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);
  const grandCount = rows.reduce((acc, r) => acc + r.count, 0);

  const rangeLabel =
    months.length === 0
      ? '—'
      : months.length === 1
        ? months[0].label
        : `${months[0].label} – ${months[months.length - 1].label}`;

  return {
    scopeLabel: scope.label,
    isAll,
    groupBy,
    startYm: normStartYm,
    endYm: normEndYm,
    rangeLabel,
    months,
    rows,
    monthTotals,
    grandTotal,
    grandCount,
    configured,
    error,
  };
}
