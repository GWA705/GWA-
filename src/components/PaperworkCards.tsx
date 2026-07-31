import type { Document } from '@prisma/client';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ isPdf }: { isPdf: boolean }) {
  return (
    <div
      className={`flex h-10 w-10 flex-none items-center justify-center rounded-md text-[10px] font-bold ${
        isPdf ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
      }`}
      aria-hidden
    >
      {isPdf ? 'PDF' : 'IMG'}
    </div>
  );
}

/**
 * Refined, card-per-file view of the paperwork GWA has shared with the dealer.
 * Each document shows a type icon, its category, size, date, and clear
 * View / Download actions.
 */
export function PaperworkCards({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return <p className="text-sm text-gray-500">No documents shared yet.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {documents.map((d) => {
        const isPdf = (d.mimeType || '').includes('pdf');
        return (
          <div
            key={d.id}
            className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand-200 hover:shadow"
          >
            <FileIcon isPdf={isPdf} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900" title={d.fileName}>
                {d.fileName}
              </p>
              <p className="mt-0.5 text-xs font-medium text-brand-700">{DOCUMENT_TYPE_LABELS[d.type]}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {formatSize(d.sizeBytes)} · {d.createdAt.toLocaleDateString('en-CA')}
              </p>
              <div className="mt-2 flex gap-2">
                <a
                  href={`/api/documents/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-green-600 px-3 py-1 text-xs font-semibold text-green-700 shadow-sm transition hover:bg-green-50"
                >
                  View
                </a>
                <a
                  href={`/api/documents/${d.id}?download=1`}
                  className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-green-700"
                >
                  Download
                </a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
