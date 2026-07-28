import type { Document } from '@prisma/client';
import { FUNDING_DOCUMENT_TYPES } from '@/lib/constants';

/**
 * Read-only funding checklist for reviewers: shows each expected funding
 * document with a green check (uploaded) or red X (missing), plus links to the
 * uploaded files. Documents are no longer required all at once, so this makes
 * it obvious at a glance what is still outstanding.
 */
export function FundingChecklist({ fundingDocs }: { fundingDocs: Document[] }) {
  return (
    <ul className="space-y-2">
      {FUNDING_DOCUMENT_TYPES.map((t) => {
        const files = fundingDocs.filter((d) => d.type === t.type);
        const done = files.length > 0;
        return (
          <li key={t.type} className="flex items-start justify-between gap-3 rounded border border-gray-100 p-3">
            <div className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${
                  done ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}
                aria-hidden
              >
                {done ? '✓' : '✕'}
              </span>
              <div>
                <div className="text-sm font-medium text-gray-800">
                  {t.label}
                  {!t.required && <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>}
                </div>
                {files.map((f) => (
                  <a
                    key={f.id}
                    href={`/api/documents/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-brand-700 hover:underline"
                  >
                    {f.fileName}
                  </a>
                ))}
              </div>
            </div>
            <span className={`badge ${done ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
              {done ? 'Uploaded' : 'Missing'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
