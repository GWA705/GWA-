'use client';

// Certificate page actions. A client component (not an inline <script>) so the
// Print handler runs under the production CSP, which blocks un-nonced inline
// scripts. "Certificate PDF" opens the branded certificate (same as the emailed
// one) in a new tab to view, print, or save.
export function CertificateActions({ pdfHref }: { pdfHref: string }) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
      >
        Certificate PDF ↗
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Print this page
      </button>
    </div>
  );
}
