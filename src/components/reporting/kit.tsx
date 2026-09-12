import type { ReactNode } from 'react';

/**
 * Shared report UI kit — one visual language for every report (dealer + staff).
 *
 * Each report keeps its own coloured HEADER BANNER; everything *below* the banner
 * (KPI tiles, tables, footnotes, spacing) comes from here so the reports read as
 * one family. Greyscale by default per the brand kit — the banner is where a
 * report's colour lives.
 */

/** Standard page/section spacing for a report body. */
export const reportSpacing = 'space-y-5';

/** One KPI / summary tile (greyscale, bordered). Use inside <ReportTiles>. */
export function ReportTile({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 text-xl font-bold text-gray-900">{value}</div>
      {sub ? <div className="text-xs text-gray-400">{sub}</div> : null}
    </div>
  );
}

/** Responsive grid for a row of <ReportTile>s (2 up on phones). */
export function ReportTiles({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
  return <div className={`grid grid-cols-2 gap-3 ${c}`}>{children}</div>;
}

/** Horizontally-scrolling, bordered shell for a report table. Put a
 * `<table className="min-w-full text-sm">…</table>` inside. */
export function ReportTableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-gray-200">{children}</div>;
}

// Shared table class strings so every report's header / rows / totals match.
// (Kept as literals in a .tsx file so Tailwind's scanner keeps them.)
export const reportTheadRow =
  'border-b-2 border-gray-300 bg-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-600';
export const reportTh = 'px-4 py-3';
export const reportThRight = 'px-4 py-3 text-right';
export const reportTd = 'px-4 py-2.5';
export const reportTdRight = 'px-4 py-2.5 text-right tabular-nums';
export const reportRowZebra = (i: number) => (i % 2 ? 'bg-gray-50/40' : '');
export const reportTfootRow = 'border-t-2 border-gray-300 bg-gray-100';
export const reportFootnote = 'text-xs text-gray-400';

/** Standard "Generated {date}" stamp for a report header (long local date). */
export function reportGeneratedLabel(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}
