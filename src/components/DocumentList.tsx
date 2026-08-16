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
  return (
    <ul className="space-y-2">
      {documents.map((d) => (
        <li key={d.id} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-2">
          {/* Thumbnail — click to open the file */}
          <DocViewer id={d.id} fileName={d.fileName} mimeType={d.mimeType} className="flex-none" title={`Open ${d.fileName}`}>
            <DocThumbnail id={d.id} mimeType={d.mimeType} />
          </DocViewer>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <DocViewer
                id={d.id}
                fileName={d.fileName}
                mimeType={d.mimeType}
                className="min-w-0 flex-1 break-words text-left text-sm font-medium text-brand-700 hover:underline"
                title={d.fileName}
              >
                {/* Lead with the uploader's label (what it is); fall back to the
                    file name for documents that don't carry one. */}
                {d.label || d.fileName}
              </DocViewer>
              {deleteAction && (
                <span className="flex-none text-xs">
                  <DeleteDocumentButton documentId={d.id} fileName={d.fileName} action={deleteAction} />
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
              <span>{DOCUMENT_TYPE_LABELS[d.type]}</span>
              <span aria-hidden>·</span>
              <span>{formatSize(d.sizeBytes)}</span>
              <span aria-hidden>·</span>
              <span>{d.createdAt.toLocaleDateString('en-CA')}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
