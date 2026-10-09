/**
 * The Home Depot Customer Approval Waiver is the same standard form on every
 * Home Depot deal, with nothing to fill in. Instead of the dealer uploading it
 * each time, the portal attaches it automatically: this card shows on HD-program
 * deals (for the dealer and the GWA review team) with View / Download links to
 * the bundled PDF. Static file lives at public/hd-customer-approval-waiver.pdf.
 */
const WAIVER_URL = '/hd-customer-approval-waiver.pdf';

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
          <a
            href={WAIVER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-green-600 px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm transition hover:bg-green-50"
          >
            View
          </a>
          <a
            href={WAIVER_URL}
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
