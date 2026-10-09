import { DocViewer } from '@/components/DocViewer';

/**
 * The Home Depot Customer Approval Waiver is the same standard form on every
 * Home Depot deal, with nothing to fill in. Instead of the dealer uploading it
 * each time, the portal attaches it automatically: this card shows on HD-program
 * deals (for the dealer and the GWA review team).
 *
 * View opens the in-app DocViewer overlay (full-screen, with a Close button that
 * works in the installed mobile app / PWA — a raw new-tab link left the viewer
 * stranded on the PDF with no way back). The overlay shows a rendered page image
 * (public/hd-customer-approval-waiver.png) so it displays reliably on iOS; the
 * Download button hands over the real PDF (public/hd-customer-approval-waiver.pdf)
 * for printing.
 */
const WAIVER_PDF = '/hd-customer-approval-waiver.pdf';
const WAIVER_IMG = '/hd-customer-approval-waiver.png';

export function HdWaiverCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-gray-100 text-xl" aria-hidden>
        📄
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold leading-snug text-gray-900">{title}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
        <div className="mt-3 flex gap-2">
          <DocViewer
            id="hd-waiver"
            src={WAIVER_IMG}
            mimeType="image/png"
            fileName={title}
            title={title}
            className="rounded-md border border-green-600 px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm transition hover:bg-green-50"
          >
            View
          </DocViewer>
          <a
            href={WAIVER_PDF}
            download="HD-Customer-Approval-Waiver.pdf"
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-green-700"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
