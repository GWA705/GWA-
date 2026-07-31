import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { decryptOptional, maskTail } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentList } from '@/components/DocumentList';
import { FundingChecklist } from '@/components/FundingChecklist';
import { LoanApplicationDetails } from '@/components/LoanApplicationDetails';
import { PayoutReceipt } from '@/components/PayoutReceipt';
import { ReviewerPaperworkForm } from './ReviewerPaperworkForm';
import { NoteThread } from '@/components/NoteThread';
import { NoteForm } from '@/components/NoteForm';
import { ConfirmationBadge } from '@/components/ConfirmationBadge';
import { DealProgress } from '@/components/DealProgress';
import { PROGRAM_CATEGORY_LABELS } from '@/lib/constants';
import { ConfirmationForm } from './ConfirmationForm';
import { DealReferencesForm } from './DealReferencesForm';
import { WriteToJournalButton } from './WriteToJournalButton';
import { DecisionForm } from './DecisionForm';
import { PayoutForm } from './PayoutForm';
import { StatusChangeForm } from './StatusChangeForm';
import {
  startReviewAction,
  uploadReviewerPaperworkAction,
  addStaffNoteAction,
} from '@/app/(staff)/actions';
import { STATUS_LABELS, programLabel, REVIEWER_PAPERWORK_TYPES } from '@/lib/constants';
import type { ApplicationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Friendly wording for each audit action shown in the deal activity log.
const ACTION_LABELS: Record<string, string> = {
  APPLICATION_CREATE: 'Created the deal',
  APPLICATION_SUBMIT: 'Submitted the application',
  APPLICATION_UPDATE: 'Edited the deal',
  PII_DECRYPT: 'Revealed protected identity',
  DECISION: 'Recorded a decision',
  STATUS_CHANGE: 'Changed status',
  DOC_UPLOAD: 'Uploaded a document',
  DOC_DOWNLOAD: 'Downloaded a document',
  JOURNAL_WRITE: 'Wrote to the sales journal',
  FUNDING_SUBMIT: 'Submitted the funding package',
  FUNDING_DECISION: 'Funding decision',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ').toLowerCase();
}

function decisionOptions(status: ApplicationStatus): { value: string; label: string }[] {
  if (['SUBMITTED', 'UNDER_REVIEW', 'CONDITIONAL'].includes(status)) {
    return [
      { value: 'APPROVE', label: 'Approve' },
      { value: 'CONDITIONAL', label: 'Conditionally approve' },
      { value: 'REQUEST_DOCS', label: 'Request more documents' },
      { value: 'DECLINE', label: 'Decline' },
    ];
  }
  if (['FUNDING_SUBMITTED', 'FUNDING_REVIEW'].includes(status)) {
    return [{ value: 'FUND', label: 'Approve funding (mark funded)' }];
  }
  return [];
}

export default async function StaffApplicationDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { reveal?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const app = await prisma.application.findUnique({
    where: { id: params.id },
    include: {
      dealer: true,
      createdBy: true,
      documents: { orderBy: { createdAt: 'desc' } },
      serialNumbers: { orderBy: { createdAt: 'asc' } },
      statusEvents: { orderBy: { createdAt: 'desc' }, include: { actor: true } },
      decisions: { orderBy: { createdAt: 'desc' }, include: { decidedBy: true } },
      consents: { orderBy: { capturedAt: 'desc' } },
      homeDepotStore: true,
      loanApplication: true,
      financeCompany: true,
      approvedBy: true,
      payouts: { orderBy: { paidOn: 'desc' }, include: { createdBy: true } },
      dealNotes: { orderBy: { createdAt: 'asc' }, include: { author: true } },
      confirmation: { include: { confirmedBy: true } },
    },
  });
  if (!app) notFound();

  const dealerNotes = app.dealNotes.filter((n) => !n.internal);
  const internalNotes = app.dealNotes.filter((n) => n.internal);

  const financeCompanies = await prisma.financeCompany.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  const reveal = searchParams.reveal === '1';

  // The government ID number is the protected identity field shown here (SIN
  // and banking are not collected). Decrypt only when revealed. ID type,
  // province, and expiry are low-sensitivity and shown without revealing.
  let govId = maskTail(decryptOptional(app.govIdNumberEnc), 3);

  if (reveal) {
    govId = decryptOptional(app.govIdNumberEnc) ?? '—';
    await audit({
      actorId: user.userId,
      action: 'PII_DECRYPT',
      entityType: 'Application',
      entityId: app.id,
      detail: 'Revealed identity fields',
    });
  }

  const applicationDocs = app.documents.filter((d) => d.stage === 'APPLICATION');
  const fundingDocs = app.documents.filter((d) => d.stage === 'FUNDING');
  const reviewerDocs = app.documents.filter((d) => d.stage === 'REVIEWER');
  const options = decisionOptions(app.status);
  const startReview = startReviewAction.bind(null, app.id);

  // Full activity log for this deal — every recorded action, and who did it, so
  // with several reviewers on staff you can always see who handled what.
  const docIds = app.documents.map((d) => d.id);
  const activity = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'Application', entityId: app.id },
        { entityType: 'Document', entityId: { in: docIds } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: { actor: true },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/staff" className="text-sm text-gray-500 hover:underline">← Back to queue</Link>
          <div className="mt-2 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">
              {app.applicantFirstName} {app.applicantLastName}
            </h1>
            <StatusBadge status={app.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-500">
              {app.dealer.name} · submitted by {app.createdBy.name} · {app.createdAt.toLocaleString('en-CA')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/staff/applications/${app.id}/edit`} className="btn-secondary text-xs">
                ✎ Edit deal
              </Link>
              {app.documents.length > 0 && (
                <a href={`/api/applications/${app.id}/documents`} className="btn-secondary text-xs">
                  ↓ Download all documents (ZIP)
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Progress tracker */}
        <DealProgress
          status={app.status}
          approvedById={app.approvedById}
          confirmationStatus={app.confirmationStatus}
          hasFundingDocs={app.documents.some((d) => d.stage === 'FUNDING')}
          hasPayouts={app.payouts.length > 0}
        />

      {/* Below the header/progress: actions column first on mobile so a reviewer
          can act without scrolling past the whole deal; back on the right at lg. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
        {/* Summary */}
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Summary</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-gray-500">Province</dt><dd className="font-medium">{app.province}</dd></div>
            <div><dt className="text-gray-500">Program</dt><dd className="font-medium">{programLabel(app.programType, app.programCategory)}</dd></div>
            <div><dt className="text-gray-500">Entry method</dt><dd className="font-medium">{app.entryMethod === 'TYPED' ? 'Typed in' : app.entryMethod === 'PHOTO' ? 'Photo upload' : 'FinanceIT #'}</dd></div>
            <div><dt className="text-gray-500">Requested</dt><dd className="font-medium">${app.requestedAmount.toString()}</dd></div>
            <div><dt className="text-gray-500">Approved amount</dt><dd className="font-medium">{app.approvedAmount ? `$${app.approvedAmount.toString()}` : '—'}</dd></div>
            <div><dt className="text-gray-500">Finance company</dt><dd className="font-medium">{app.financeCompany?.name ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Approved by</dt><dd className="font-medium">{app.approvedBy?.name ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Date of sale</dt><dd className="font-medium">{app.dateOfSale ? app.dateOfSale.toLocaleDateString('en-CA') : '—'}</dd></div>
            <div><dt className="text-gray-500">Installation date</dt><dd className="font-medium">{app.installationDate ? app.installationDate.toLocaleDateString('en-CA') : '—'}</dd></div>
            <div><dt className="text-gray-500">HD store</dt><dd className="font-medium">{app.homeDepotStore ? app.homeDepotStore.number : '—'}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{app.applicantEmail}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{app.applicantPhone}</dd></div>
            <div><dt className="text-gray-500">Income</dt><dd className="font-medium">{app.incomeAnnual ? `$${app.incomeAnnual.toString()}` : '—'}</dd></div>
            <div><dt className="text-gray-500">Financing deal number</dt><dd className="font-medium">{app.financeItNumber ?? '—'}</dd></div>
            <div><dt className="text-gray-500">HD Customer #</dt><dd className="font-medium">{app.hdReference ?? '—'}</dd></div>
          </dl>
          {app.financingNote && (
            <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-600"><span className="font-medium text-gray-700">Financing note: </span>{app.financingNote}</p>
          )}
          {app.notes && <p className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-600">{app.notes}</p>}
        </section>

        {/* Sensitive */}
        <section className="card border-amber-200 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Identity (protected)</h2>
            {reveal ? (
              <Link href={`/staff/applications/${app.id}`} className="text-xs text-brand-700 hover:underline">
                Hide
              </Link>
            ) : (
              <Link href={`/staff/applications/${app.id}?reveal=1`} className="btn-secondary text-xs">
                Reveal (logged)
              </Link>
            )}
          </div>
          {reveal && (
            <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-700">
              This access has been recorded in the audit log.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-gray-500">Gov ID type</dt><dd className="font-medium">{app.loanApplication?.idType || '—'}</dd></div>
            <div><dt className="text-gray-500">Gov ID #</dt><dd className="font-mono font-medium">{govId}</dd></div>
            <div><dt className="text-gray-500">Province of issue</dt><dd className="font-medium">{app.loanApplication?.idProvince || '—'}</dd></div>
            <div><dt className="text-gray-500">ID expiry</dt><dd className="font-medium">{app.loanApplication?.idExpiry ? app.loanApplication.idExpiry.toLocaleDateString('en-CA') : '—'}</dd></div>
          </dl>
        </section>

        {app.loanApplication && (
          <LoanApplicationDetails
            loan={app.loanApplication}
            co={
              reveal
                ? {
                    dob: decryptOptional(app.loanApplication.coDobEnc),
                    address: decryptOptional(app.loanApplication.coAddressEnc),
                    govId: decryptOptional(app.loanApplication.coGovIdNumberEnc),
                  }
                : undefined
            }
          />
        )}

        {/* Notes to dealer */}
        <section className="card p-6">
          <h2 className="text-base font-semibold text-gray-900">Notes to dealer</h2>
          <p className="mb-3 text-xs text-gray-500">Visible to the dealer on this deal.</p>
          <div className="mb-4">
            <NoteThread notes={dealerNotes} emptyText="No messages with the dealer yet." />
          </div>
          <NoteForm
            action={addStaffNoteAction}
            hidden={{ applicationId: app.id, internal: 'false' }}
            placeholder="Write a note to the dealer…"
            label="Send to dealer"
          />
        </section>

        {/* Internal notes */}
        <section className="card border-amber-200 p-6">
          <h2 className="text-base font-semibold text-gray-900">Internal notes</h2>
          <p className="mb-3 text-xs text-amber-700">Only Reviewers and Admins can see these — never shown to the dealer.</p>
          <div className="mb-4">
            <NoteThread notes={internalNotes} emptyText="No internal notes yet." />
          </div>
          <NoteForm
            action={addStaffNoteAction}
            hidden={{ applicationId: app.id, internal: 'true' }}
            placeholder="Internal note (staff only)…"
            label="Add internal note"
          />
        </section>

        {/* Documents */}
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Application documents</h2>
          <DocumentList documents={applicationDocs} />
        </section>

        {(['APPROVED', 'CONDITIONAL', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'].includes(app.status) ||
          fundingDocs.length > 0 ||
          app.serialNumbers.length > 0) && (
          <section className="card p-6">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Funding package</h2>
            {app.serialNumbers.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-1 text-sm font-medium text-gray-700">Serial numbers</h3>
                <ul className="text-sm">
                  {app.serialNumbers.map((s) => (
                    <li key={s.id} className="font-mono text-gray-700">
                      {s.value}{s.productLabel && <span className="ml-2 font-sans text-gray-400">({s.productLabel})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <FundingChecklist fundingDocs={fundingDocs} applicationId={app.id} status={app.status} />
          </section>
        )}

        {/* Paperwork for the dealer (HD / Financing) */}
        <section className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Paperwork for dealer</h2>
          <p className="mb-4 text-xs text-gray-500">Upload paperwork the dealer can view and download. Files are converted to PDF.</p>
          <div className="mb-4">
            <DocumentList documents={reviewerDocs} />
          </div>
          <div className="border-t border-gray-100 pt-4">
            <ReviewerPaperworkForm
              action={uploadReviewerPaperworkAction.bind(null, app.id)}
              categories={REVIEWER_PAPERWORK_TYPES}
            />
          </div>
        </section>

        {/* Payout / receipt */}
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Payout / receipt</h2>
          <div className="mb-5">
            <PayoutReceipt payouts={app.payouts} />
          </div>
          <div className="border-t border-gray-100 pt-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Record a payout</h3>
            <PayoutForm applicationId={app.id} />
          </div>
        </section>

        {/* Confirmation call */}
        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Confirmation call</h2>
            <ConfirmationBadge status={app.confirmationStatus} />
          </div>
          <p className="mb-4 text-xs text-gray-500">UEI confirmation script — work through it on the call, check all six boxes, then Confirm.</p>
          <ConfirmationForm
            applicationId={app.id}
            data={app.confirmation}
            applicantName={`${app.applicantFirstName} ${app.applicantLastName}`}
            defaultProduct={PROGRAM_CATEGORY_LABELS[app.programCategory]}
            defaultPhone={app.applicantPhone}
            defaultAmount={(app.approvedAmount ?? app.requestedAmount).toString()}
          />
        </section>

        {/* History */}
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">History</h2>
          <ul className="space-y-2 text-sm">
            {app.statusEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span>
                  {e.from ? `${STATUS_LABELS[e.from]} → ` : ''}
                  <span className="font-medium">{STATUS_LABELS[e.to]}</span>
                  {e.note && <span className="ml-2 text-gray-500">— {e.note}</span>}
                  <span className="ml-2 text-xs text-gray-400">by {e.actor.name}</span>
                </span>
                <span className="text-xs text-gray-400">{e.createdAt.toLocaleString('en-CA')}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Full activity log — who did what, across all reviewers */}
        <section className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Activity log</h2>
          <p className="mb-3 text-xs text-gray-500">
            Everything that happened on this deal, and which team member did it.
          </p>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2 last:border-0">
                  <span>
                    <span className="font-medium text-gray-800">{e.actor?.name ?? 'System'}</span>
                    <span className="text-gray-600"> — {actionLabel(e.action)}</span>
                    {e.detail && <span className="ml-1 text-gray-400">({e.detail})</span>}
                  </span>
                  <span className="flex-none text-xs text-gray-400">{e.createdAt.toLocaleString('en-CA')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Decision sidebar — first on mobile, right-hand column at lg. */}
      <div className="order-1 space-y-6 lg:order-2">
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Decision</h2>
          {app.status === 'SUBMITTED' && (
            <form action={startReview} className="mb-4">
              <button type="submit" className="btn-secondary w-full">Start review</button>
            </form>
          )}
          {app.status === 'FUNDING_SUBMITTED' && (
            <p className="mb-4 rounded bg-amber-50 p-2 text-xs text-amber-800">
              Confirm the funding documents in the checklist above, then move this deal to
              “In for funding.”
            </p>
          )}
          <DecisionForm
            applicationId={app.id}
            options={options}
            financeCompanies={financeCompanies}
            defaultAmount={app.requestedAmount.toString()}
          />

          <div className="mt-5 border-t border-gray-100 pt-4">
            <StatusChangeForm applicationId={app.id} current={app.status} />
            <p className="mt-2 text-xs text-gray-400">
              Change the status at any time (e.g. flag a Problem, or move it back).
            </p>
          </div>
        </section>

        {['APPROVED', 'CONDITIONAL', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'].includes(app.status) && (
          <section className="card p-6">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Deal reference numbers</h2>
            <DealReferencesForm
              applicationId={app.id}
              financeItNumber={app.financeItNumber}
              hdReference={app.hdReference}
            />
            {app.hdReference && app.financeItNumber && (
              <WriteToJournalButton
                applicationId={app.id}
                syncedAt={app.journalSyncedAt ? app.journalSyncedAt.toISOString() : null}
                tab={app.journalTab}
                row={app.journalRow}
              />
            )}
          </section>
        )}

        {app.decisions.length > 0 && (
          <section className="card p-6">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Decision log</h2>
            <ul className="space-y-2 text-sm">
              {app.decisions.map((d) => (
                <li key={d.id} className="rounded border border-gray-100 bg-gray-50 p-2">
                  <span className="font-medium">{d.type.replace('_', ' ')}</span>
                  {d.notes && <p className="text-gray-600">{d.notes}</p>}
                  <p className="text-xs text-gray-400">{d.decidedBy.name} · {d.createdAt.toLocaleString('en-CA')}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {app.consents.length > 0 && (
          <section className="card p-6 text-xs text-gray-500">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Consent</h2>
            <p>Captured {app.consents[0].capturedAt.toLocaleString('en-CA')}</p>
            <p>Policy version: {app.consents[0].policyVersion}</p>
            {app.consents[0].ipAddress && <p>IP: {app.consents[0].ipAddress}</p>}
          </section>
        )}
      </div>
      </div>
    </div>
  );
}
