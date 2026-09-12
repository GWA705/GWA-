import type { ReactNode } from 'react';

/**
 * Shared report UI kit — one visual language for every report (dealer + staff):
 * the "Slate Executive" look. A branded header (GWA icon lockup, petrol-navy
 * rule), petrol-navy-accented KPI tiles and table headers, and the bilingual
 * brand stamp at the foot of every report. Reports that carry their own coloured
 * banner keep it; everything else comes from here so they read as one family.
 */

/** The house style's petrol-navy accent. */
export const SLATE = '#123448';

/** Standard page/section spacing for a report body. */
export const reportSpacing = 'space-y-5';

/** One KPI / summary tile — Slate-accented (navy top rule). Use in <ReportTiles>. */
export function ReportTile({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="report-tile rounded-xl border border-gray-200 border-t-[3px] border-t-[#123448] bg-white px-4 py-3">
      <div className="rt-label text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="rt-value mt-0.5 text-xl font-bold text-gray-900">{value}</div>
      {sub ? <div className="rt-sub text-xs text-gray-400">{sub}</div> : null}
    </div>
  );
}

/**
 * Branded Slate report header: GWA icon lockup, title, scope, generated date,
 * over a petrol-navy rule. For reports without their own coloured banner. All
 * text is passed in (already translated) by the caller.
 */
export function ReportHeader({
  org = 'Georgian Water & Air', sub, title, scope, generated, actions,
}: {
  org?: string; sub?: ReactNode; title: ReactNode; scope?: ReactNode; generated?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b-[3px] border-[#123448] pb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <img src="/brand/gwa-icon.png" alt="" width="34" height="34" className="h-[34px] w-[34px] flex-none" />
          <div>
            <div className="text-[12.5px] font-bold uppercase tracking-wide text-gray-800">{org}</div>
            {sub ? <div className="text-[11px] text-gray-500">{sub}</div> : null}
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">{title}</h1>
        {scope ? <p className="mt-0.5 text-sm text-gray-600">{scope}</p> : null}
      </div>
      {(actions || generated) && (
        <div className="flex flex-col items-end gap-2">
          {actions}
          {generated ? <div className="text-right text-xs text-gray-400">{generated}</div> : null}
        </div>
      )}
    </div>
  );
}

/**
 * The GWA brand stamp for the foot of EVERY report — the "stamp on every printout".
 * Icon + brand line (bilingual, passed in) + generated date. Sits inside the
 * print sheet so it prints. `brand` is e.g. "GWA Portal · Georgian Water & Air".
 */
export function ReportStamp({ brand, generated }: { brand: string; generated: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
      <span className="flex items-center gap-2 text-[10.5px] font-semibold tracking-wide text-gray-600">
        <img src="/brand/gwa-icon.png" alt="" width="16" height="16" className="h-4 w-4" />
        {brand}
      </span>
      <span className="text-[10px] tabular-nums text-gray-400">{generated}</span>
    </div>
  );
}

/** Responsive grid for a row of <ReportTile>s (2 up on phones). */
export function ReportTiles({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
  return <div className={`report-tiles grid grid-cols-2 gap-3 ${c}`}>{children}</div>;
}

/** Horizontally-scrolling, bordered shell for a report table. Put a
 * `<table className="min-w-full text-sm">…</table>` inside. */
export function ReportTableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-gray-200">{children}</div>;
}

// Shared table class strings so every report's header / rows / totals match.
// (Kept as literals in a .tsx file so Tailwind's scanner keeps them.)
export const reportTheadRow =
  'border-b-2 border-[#123448]/30 bg-[#eef3f6] text-left text-[11px] uppercase tracking-wide text-[#123448]';
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
