import type { Document } from '@prisma/client';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// A small document preview: the real image for photos, or a clean stylized page
// with a coloured file-type ribbon for PDFs/other files.
function DocThumb({ doc }: { doc: Document }) {
  const isImage = (doc.mimeType || '').startsWith('image/');
  const isPdf = (doc.mimeType || '').includes('pdf');
  if (isImage) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={`/api/documents/${doc.id}`}
        alt=""
        className="h-20 w-16 flex-none rounded-lg object-cover ring-1 ring-gray-200"
      />
    );
  }
  const ribbon = isPdf ? 'bg-red-600' : 'bg-blue-600';
  const label = isPdf ? 'PDF' : (doc.fileName.split('.').pop() || 'FILE').slice(0, 4).toUpperCase();
  return (
    <div className="relative h-20 w-16 flex-none overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200" aria-hidden>
      {/* folded corner */}
      <div className="absolute right-0 top-0 h-4 w-4 bg-gray-100" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
      {/* faint text lines to read as a page */}
      <div className="space-y-1.5 p-2.5 pt-3">
        <div className="h-1 w-9 rounded bg-gray-200" />
        <div className="h-1 w-7 rounded bg-gray-200" />
        <div className="h-1 w-8 rounded bg-gray-200" />
        <div className="h-1 w-6 rounded bg-gray-200" />
      </div>
      <div className={`absolute inset-x-0 bottom-0 ${ribbon} py-0.5 text-center text-[9px] font-bold tracking-wide text-white`}>
        {label}
      </div>
    </div>
  );
}

/**
 * Modern, card-per-file view of the paperwork GWA has shared with the dealer.
 * The document's purpose (its category) is the headline; the raw file name is
 * deliberately hidden. Each card shows a preview thumbnail and View / Download.
 */
export function PaperworkCards({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return <p className="text-sm text-gray-500">No documents shared yet.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {documents.map((d) => (
        <div
          key={d.id}
          className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <DocThumb doc={d} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-base font-semibold leading-snug text-gray-900">{DOCUMENT_TYPE_LABELS[d.type]}</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              {formatSize(d.sizeBytes)} · {d.createdAt.toLocaleDateString('en-CA')}
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href={`/api/documents/${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-green-600 px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm transition hover:bg-green-50"
              >
                View
              </a>
              <a
                href={`/api/documents/${d.id}?download=1`}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-green-700"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
