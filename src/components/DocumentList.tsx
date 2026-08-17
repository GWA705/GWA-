import type { Document } from '@prisma/client';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { DeleteDocumentButton } from '@/components/DeleteDocumentButton';
import { DocViewer } from '@/components/DocViewer';
import { DocThumbnail } from '@/components/DocThumbnail';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentList({
  documents,
  deleteAction,
}: {
  documents: Document[];
  // When provided (staff pages), each row gets a Delete button.
  deleteAction?: (id: string) => Promise<{ error?: string }>;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-gray-500">No documents uploaded yet.</p>;
  }

  // Raw upload filenames aren't shown — each doc gets a clean, consistent name:
  // its own label if it has one, else "<type>" (with "— File N" when there's
  // more than one of that type). The real filename stays behind the viewer.
  const typeTotals = new Map<string, number>();
  for (const d of documents) typeTotals.set(d.type, (typeTotals.get(d.type) ?? 0) + 1);
  const typeSeen = new Map<string, number>();

  return (
    <ul className="space-y-2">
      {documents.map((d) => {
        const typeLabel = DOCUMENT_TYPE_LABELS[d.type];
        const n = (typeSeen.get(d.type) ?? 0) + 1;
        typeSeen.set(d.type, n);
        const total = typeTotals.get(d.type) ?? 1;
        const displayName = d.label?.trim() || (total > 1 ? `${typeLabel} — File ${n}` : typeLabel);
        // Show the type in the meta line only when it isn't already the title.
        const metaBits = [d.label?.trim() ? typeLabel : null, formatSize(d.sizeBytes), d.createdAt.toLocaleDateString('en-CA')].filter(Boolean) as string[];

        return (
          <li key={d.id} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-2">
            {/* Thumbnail — click to open the file */}
            <DocViewer id={d.id} fileName={d.fileName} mimeType={d.mimeType} className="flex-none" title={`Open ${displayName}`}>
              <DocThumbnail id={d.id} mimeType={d.mimeType} />
            </DocViewer>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <DocViewer
                  id={d.id}
                  fileName={d.fileName}
                  mimeType={d.mimeType}
                  className="min-w-0 flex-1 break-words text-left text-sm font-medium text-brand-700 hover:underline"
                  title={displayName}
                >
                  {displayName}
                </DocViewer>
                {deleteAction && (
                  <span className="flex-none text-xs">
                    <DeleteDocumentButton documentId={d.id} fileName={displayName} action={deleteAction} />
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
                {metaBits.map((b, i) => (
                  <span key={i} className="flex items-center gap-x-2">
                    {i > 0 && <span aria-hidden>·</span>}
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
