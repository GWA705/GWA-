import type { Document } from '@prisma/client';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { DocViewer } from '@/components/DocViewer';
import { DownloadButton } from '@/components/DownloadButton';
import { PaperworkThumb } from '@/components/PaperworkThumb';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
          <PaperworkThumb doc={d} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-base font-semibold leading-snug text-gray-900">{DOCUMENT_TYPE_LABELS[d.type]}</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              {formatSize(d.sizeBytes)} · {d.createdAt.toLocaleDateString('en-CA')}
            </p>
            <div className="mt-3 flex gap-2">
              <DocViewer
                id={d.id}
                fileName={d.fileName}
                mimeType={d.mimeType}
                title={DOCUMENT_TYPE_LABELS[d.type]}
                className="rounded-md border border-green-600 px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm transition hover:bg-green-50"
              >
                View
              </DocViewer>
              <DownloadButton
                url={`/api/documents/${d.id}?download=1`}
                fileName={d.fileName}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-green-700"
              >
                Download
              </DownloadButton>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
