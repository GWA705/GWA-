import type { Document } from '@prisma/client';
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants';
import { DeleteDocumentButton } from '@/components/DeleteDocumentButton';

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
  return (
    <ul className="divide-y divide-gray-100 text-sm">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0 flex-1">
            <a
              href={`/api/documents/${d.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate font-medium text-brand-700 hover:underline"
              title={d.fileName}
            >
              {d.fileName}
            </a>
            <span className="text-xs text-gray-400">
              {DOCUMENT_TYPE_LABELS[d.type]} · {formatSize(d.sizeBytes)}
            </span>
          </div>
          <span className="flex-none text-xs text-gray-400">{d.createdAt.toLocaleDateString('en-CA')}</span>
          {deleteAction && <DeleteDocumentButton documentId={d.id} fileName={d.fileName} action={deleteAction} />}
        </li>
      ))}
    </ul>
  );
}
