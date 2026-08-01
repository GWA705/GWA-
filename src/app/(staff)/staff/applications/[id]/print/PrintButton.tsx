'use client';

export function PrintButton() {
  return (
    <button type="button" className="btn-secondary text-sm print:hidden" onClick={() => window.print()}>
      🖨 Print
    </button>
  );
}
