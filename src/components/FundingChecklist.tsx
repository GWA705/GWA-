import type { Document, ApplicationStatus } from '@prisma/client';
import { FUNDING_DOCUMENT_TYPES } from '@/lib/constants';
import {
  toggleDocumentVerifiedAction,
  verifyAllFundingDocsAction,
  moveToInForFundingAction,
  deleteDocumentAction,
} from '@/app/(staff)/actions';
import { DeleteDocumentButton } from '@/components/DeleteDocumentButton';
import { DocViewer } from '@/components/DocViewer';

/**
 * Reviewer funding checklist. Each required document shows green ✓ when a
 * completed/verified file exists, amber when uploaded-but-unconfirmed, red ✕
 * when missing. The reviewer views each file and marks it complete (one click,
 * or "Mark all completed"). Only when every required item is confirmed can the
 * deal be moved to "In for funding".
 */
export function FundingChecklist({
  fundingDocs,
  applicationId,
  status,
}: {
  fundingDocs: Document[];
  applicationId: string;
  status: ApplicationStatus;
}) {
  const verifiedTypes = new Set(fundingDocs.filter((d) => d.verifiedAt).map((d) => d.type));
  const allRequiredVerified = FUNDING_DOCUMENT_TYPES.filter((t) => t.required).every((t) =>
    verifiedTypes.has(t.type),
  );
  const hasDocs = fundingDocs.length > 0;
  const hasUnverified = fundingDocs.some((d) => !d.verifiedAt);
  const canMove = status === 'FUNDING_SUBMITTED';

  const verifyAll = verifyAllFundingDocsAction.bind(null, applicationId);
  const moveToFunding = moveToInForFundingAction.bind(null, applicationId);

  return (
    <div>
      <ul className="space-y-2">
        {FUNDING_DOCUMENT_TYPES.map((t) => {
          const files = fundingDocs.filter((d) => d.type === t.type);
          const verified = files.some((d) => d.verifiedAt);
          const state = verified ? 'verified' : files.length > 0 ? 'uploaded' : 'missing';
          const badge =
            state === 'verified'
              ? 'bg-green-100 text-green-800'
              : state === 'uploaded'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-red-100 text-red-700';
          const label =
            state === 'verified' ? 'Completed' : state === 'uploaded' ? 'Needs review' : 'Missing';
          const icon =
            state === 'verified' ? '✓' : state === 'uploaded' ? '!' : '✕';
          const iconCls =
            state === 'verified'
              ? 'bg-green-100 text-green-700'
              : state === 'uploaded'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-600';

          return (
            <li key={t.type} className="rounded border border-gray-100 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${iconCls}`} aria-hidden>
                    {icon}
                  </span>
                  <div className="text-sm font-medium text-gray-800">
                    {t.label}
                    {!t.required && <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>}
                  </div>
                </div>
                <span className={`badge ${badge}`}>{label}</span>
              </div>

              {files.length > 0 && (
                <ul className="mt-2 space-y-1.5 pl-7">
                  {files.map((f) => {
                    const toggle = toggleDocumentVerifiedAction.bind(null, f.id);
                    const done = !!f.verifiedAt;
                    return (
                      <li key={f.id} className="flex items-center justify-between gap-3 text-xs">
                        <DocViewer id={f.id} fileName={f.fileName} mimeType={f.mimeType} className="min-w-0 flex-1 truncate text-left text-brand-700 hover:underline">
                          {f.fileName}
                        </DocViewer>
                        <DeleteDocumentButton documentId={f.id} fileName={f.fileName} action={deleteDocumentAction} />
                        <form action={toggle}>
                          <button
                            type="submit"
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition ${
                              done
                                ? 'bg-green-50 text-green-700 ring-green-200 hover:bg-green-100'
                                : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
                            }`}
                            title={done ? 'Mark as not completed' : 'View, then mark completed'}
                          >
                            <span className={`flex h-4 w-4 items-center justify-center rounded border ${done ? 'border-green-600 bg-green-600 text-white' : 'border-gray-400'}`}>
                              {done ? '✓' : ''}
                            </span>
                            {done ? 'Completed' : 'Mark completed'}
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        {hasUnverified ? (
          <form action={verifyAll}>
            <button type="submit" className="btn-secondary text-sm">Mark all completed</button>
          </form>
        ) : hasDocs ? (
          <span className="text-xs text-gray-400">All uploaded documents confirmed.</span>
        ) : (
          <span className="text-xs text-gray-400">No documents uploaded yet.</span>
        )}

        {canMove && (
          <form action={moveToFunding} className="flex items-center gap-2">
            {!allRequiredVerified && (
              <span className="text-xs text-amber-700">Confirm all required documents first</span>
            )}
            <button type="submit" className="btn-primary text-sm" disabled={!allRequiredVerified}>
              Move to In for funding
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
