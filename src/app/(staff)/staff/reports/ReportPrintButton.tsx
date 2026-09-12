'use client';

// Print / Save-as-PDF for a report. Hidden in the printout itself (`no-print`),
// and uses the app's global print convention (the `.print-only` wrapper is the
// only thing that renders on paper).
export function ReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print btn-secondary text-sm"
    >
      🖨 Print / Save as PDF
    </button>
  );
}
