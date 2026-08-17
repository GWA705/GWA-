import type { Document, ApplicationStatus, ProgramType } from '@prisma/client';
import { fundingDocumentTypesFor } from '@/lib/constants';
import {
  verifyAllFundingDocsAction,
  moveToInForFundingAction,
  deleteDocumentAction,
} from '@/app/(staff)/actions';
import { DeleteDocumentButton } from '@/components/DeleteDocumentButton';
import { DocViewer } from '@/components/DocViewer';
import { DocThumbnail } from '@/components/DocThumbnail';
import { VerifyDocButton } from '@/components/VerifyDocButton';
import { summarizeAnalysis, ocrEligible, type ChipTone } from '@/lib/docanalysis-format';
import { OcrButton } from '@/components/OcrButton';

const CHIP_CLASS: Record<ChipTone, string> = {
  good: 'bg-green-50 text-green-700 ring-green-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  neutral: 'bg-gray-50 text-gray-600 ring-gray-200',
};

// The automated pre-check summary, laid out compactly under the file name.
function AutoCheckLine({ documentId, analysis }: { documentId: string; analysis: unknown }) {
  const chips = summarizeAnalysis(analysis);
  const canOcr = ocrEligible(analysis);
  if (chips.length === 0 && !canOcr) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {chips.map((c, i) => (
        <span key={i} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CHIP_CLASS[c.tone]}`}>
          {c.label}
        </span>
      ))}
      {canOcr && <OcrButton documentId={documentId} />}
    </div>
  );
}

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
  programType,
}: {
  fundingDocs: Document[];
  applicationId: string;
  status: ApplicationStatus;
  programType: ProgramType;
}) {
  const docTypes = fundingDocumentTypesFor(programType);
  const verifiedTypes = new Set(fundingDocs.filter((d) => d.verifiedAt).map((d) => d.type));
  const allRequiredVerified = docTypes.filter((t) => t.required).every((t) =>
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
        {docTypes.map((t) => {
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
                <ul className="mt-2 space-y-2">
                  {files.map((f, i) => {
                    // Reviewers don't need the raw upload filename — show a clean,
                    // consistent label (the file's own label if it has one, else
                    // "<type> — File N"). The real name is still used for the
                    // viewer header + download.
                    const displayName = f.label?.trim() || `${t.label} — File ${i + 1}`;
                    return (
                      <li key={f.id} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-2">
                        {/* Thumbnail — click to open the file */}
                        <DocViewer id={f.id} fileName={f.fileName} mimeType={f.mimeType} className="flex-none" title={`Open ${displayName}`}>
                          <DocThumbnail id={f.id} mimeType={f.mimeType} />
                        </DocViewer>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <DocViewer id={f.id} fileName={f.fileName} mimeType={f.mimeType} className="min-w-0 flex-1 break-words text-left text-sm font-medium text-brand-700 hover:underline">
                              {displayName}
                            </DocViewer>
                            <VerifyDocButton documentId={f.id} done={!!f.verifiedAt} />
                          </div>
                          <AutoCheckLine documentId={f.id} analysis={f.analysis} />
                          <div className="mt-1.5 text-xs">
                            <DeleteDocumentButton documentId={f.id} fileName={displayName} action={deleteDocumentAction} />
                          </div>
                        </div>
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
