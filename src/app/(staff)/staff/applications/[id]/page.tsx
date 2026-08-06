import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { decryptOptional } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentList } from '@/components/DocumentList';
import { FundingChecklist } from '@/components/FundingChecklist';
import { VerificationChecklist, type VerificationState } from '@/components/VerificationChecklist';
import { ReviewerEntryView } from '@/components/ReviewerEntryView';
import { CollapsibleEntry } from '@/components/CollapsibleEntry';
import { PayoutReceipt } from '@/components/PayoutReceipt';
import { ReviewerPaperworkForm } from './ReviewerPaperworkForm';
import { NoteThread } from '@/components/NoteThread';
import { NoteForm } from '@/components/NoteForm';
import { ConfirmationBadge } from '@/components/ConfirmationBadge';
import { DealProgress } from '@/components/DealProgress';
import { ProgramBadge } from '@/components/ProgramBadge';
import {
  PROGRAM_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  dealIsFinanced,
  hdReferenceRequired,
  missingRequiredReferences,
} from '@/lib/constants';
import { ConfirmationForm } from './ConfirmationForm';
import { DealReferencesForm } from './DealReferencesForm';
import { WriteToJournalButton } from './WriteToJournalButton';
import { DecisionForm } from './DecisionForm';
import { PayoutForm } from './PayoutForm';
import { StatusChangeForm } from './StatusChangeForm';
import { ReviewerWorkspace } from './ReviewerWorkspace';
import { reviewerPhaseStates, dealerFacingStatus } from '@/lib/reviewerFlow';
import { exemptionSummary } from '@/lib/tax';
import { dealHasFinancing, financedAmountOf } from '@/lib/payments';
import { PaymentBreakdown } from '@/components/PaymentBreakdown';
import {
  startReviewAction,
  uploadReviewerPaperworkAction,
  addStaffNoteAction,
  toggleFinanceNumberVerifiedAction,
  deleteDocumentAction,
} from '@/app/(staff)/actions';
import { STATUS_LABELS, REVIEWER_PAPERWORK_TYPES, applicableVerificationChecks } from '@/lib/constants';
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
  // The deal and the two independent lookups (finance companies, note
  // templates) run concurrently so their now-cross-region round trips overlap
  // instead of stacking one after another.
  const [app, financeCompanies, noteTemplates] = await Promise.all([
    prisma.application.findUnique({
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
      financeNumberVerifiedBy: true,
      payouts: { orderBy: { paidOn: 'desc' }, include: { createdBy: true } },
      dealNotes: { orderBy: { createdAt: 'asc' }, include: { author: true } },
      confirmation: { include: { confirmedBy: true } },
      verificationChecks: { include: { checkedBy: true } },
      paymentSplits: { orderBy: { sortOrder: 'asc' } },
    },
    }),
    prisma.financeCompany.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.noteTemplate.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { label: true, body: true },
    }),
  ]);
  if (!app) notFound();

  // Rule 2 — funding verification checklist. The serial-match item only applies
  // when the finance company requires a serial per product (e.g. UEI).
  const verificationItems = applicableVerificationChecks(
    !!app.financeCompany?.requiresSerialPerProduct,
    app.taxExempt,
  );
  const verificationStates: Record<string, VerificationState> = {};
  for (const v of app.verificationChecks) {
    verificationStates[v.key] = {
      status: v.status,
      note: v.note,
      checkedByName: v.checkedBy?.name ?? null,
      checkedAt: v.checkedAt ? v.checkedAt.toISOString() : null,
    };
  }
  const verificationComplete = verificationItems.every(
    (i) => verificationStates[i.key]?.status === 'CONFIRMED',
  );

  const dealerNotes = app.dealNotes.filter((n) => !n.internal);
  const internalNotes = app.dealNotes.filter((n) => n.internal);

  const reveal = searchParams.reveal === '1';

  // Protected identity fields (DOB, street address, government ID number — SIN
  // and banking are not collected) are shown masked, and decrypted only when
  // the reviewer explicitly reveals them (which is audited). This lets the
  // reviewer read the whole application straight down when re-keying it into a
  // lender's portal. A masked value shows dots when present, an em dash when the
  // field is empty.
  const masked = (enc: string | null | undefined) => (enc ? '••••••' : '—');
  const loan = app.loanApplication;
  const pv = reveal
    ? {
        dob: decryptOptional(app.applicantDobEnc) ?? '—',
        address: decryptOptional(app.applicantAddressEnc) ?? '—',
        govId: decryptOptional(app.govIdNumberEnc) ?? '—',
        coDob: decryptOptional(loan?.coDobEnc) ?? '—',
        coAddress: decryptOptional(loan?.coAddressEnc) ?? '—',
        coGovId: decryptOptional(loan?.coGovIdNumberEnc) ?? '—',
      }
    : {
        // Masked branch: never decrypt protected fields (a decrypt without an
        // explicit, audited reveal would be an unlogged PII access). Show dots
        // when a value exists, an em dash when empty.
        dob: masked(app.applicantDobEnc),
        address: masked(app.applicantAddressEnc),
        govId: masked(app.govIdNumberEnc),
        coDob: masked(loan?.coDobEnc),
        coAddress: masked(loan?.coAddressEnc),
        coGovId: masked(loan?.coGovIdNumberEnc),
      };

  if (reveal) {
    await audit({
      actorId: user.userId,
      action: 'PII_DECRYPT',
      entityType: 'Application',
      entityId: app.id,
      detail: 'Revealed identity fields (reviewer entry view)',
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

  // ---- Phase-driven workspace assembly ------------------------------------
  // The reviewer page lays itself out around the real workflow (see
  // lib/reviewerFlow). Each phase's section content is built here and handed to
  // ReviewerWorkspace, which arranges it as either a guided Flow or Tabs.
  const flowSignals = {
    status: app.status,
    reviewerDocsSent: reviewerDocs.length > 0,
    fundingDocsReceived: fundingDocs.length > 0,
    hasPayouts: app.payouts.length > 0,
  };
  const dealerStatus = dealerFacingStatus(flowSignals);
  const dealFinanced = dealHasFinancing(app);
  const financedAmt = financedAmountOf(app);

  const phaseBody: Record<string, ReactNode> = {
    // 1 · Review & decide
    decide: (
      <div className="space-y-6">
        <CollapsibleEntry
          storageKey={`entryview:${app.id}`}
          snapshot={
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div><dt className="text-gray-500">Program</dt><dd><ProgramBadge type={app.programType} category={PROGRAM_CATEGORY_LABELS[app.programCategory]} /></dd></div>
              <div><dt className="text-gray-500">Customer</dt><dd className="font-medium">{app.applicantFirstName} {app.applicantLastName}</dd></div>
              <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{app.applicantPhone}</dd></div>
              <div><dt className="text-gray-500">City</dt><dd className="font-medium">{app.loanApplication?.city ?? '—'}{app.loanApplication?.addressProvince ? `, ${app.loanApplication.addressProvince}` : ''}</dd></div>
              <div><dt className="text-gray-500">Product(s)</dt><dd className="font-medium">{app.productsSold.length ? app.productsSold.join(', ') : '—'}</dd></div>
              <div><dt className="text-gray-500">Amount</dt><dd className="font-medium">{app.approvedAmount ? `$${app.approvedAmount.toString()}` : `$${app.requestedAmount.toString()}`}</dd></div>
              {app.isSplitPayment && <div><dt className="text-gray-500">Financed</dt><dd className="font-medium text-brand-700">${financedAmt.toLocaleString('en-CA', { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-gray-400">(split)</span></dd></div>}
              {app.paymentMethod && <div><dt className="text-gray-500">Payment</dt><dd className="font-medium">{PAYMENT_METHOD_LABELS[app.paymentMethod]}</dd></div>}
              <div><dt className="text-gray-500">Finance company</dt><dd className="font-medium">{app.financeCompany?.name ?? '—'}</dd></div>
              <div><dt className="text-gray-500">Financing deal #</dt><dd className="font-medium">{app.financeItNumber ?? '—'}</dd></div>
              <div><dt className="text-gray-500">HD Customer #</dt><dd className="font-medium">{app.hdReference ?? '—'}</dd></div>
            </dl>
          }
        >
          <ReviewerEntryView
            app={app}
            loan={loan}
            reveal={reveal}
            pv={pv}
            revealHref={`/staff/applications/${app.id}?reveal=1`}
            hideHref={`/staff/applications/${app.id}`}
            printHref={`/staff/applications/${app.id}/print`}
          />
        </CollapsibleEntry>
        {app.isSplitPayment && app.paymentSplits.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <PaymentBreakdown
              splits={app.paymentSplits}
              total={Number(app.approvedAmount ?? app.requestedAmount)}
              financed={financedAmt}
            />
          </div>
        )}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Application documents</h3>
          <DocumentList documents={applicationDocs} deleteAction={deleteDocumentAction} />
        </div>
      </div>
    ),
    // 2 · Produce install documents
    produce: (
      <div>
        <p className="mb-4 text-xs text-gray-500">Upload paperwork the dealer can view and download. Files are converted to PDF.</p>
        <div className="mb-4">
          <DocumentList documents={reviewerDocs} deleteAction={deleteDocumentAction} />
        </div>
        <div className="border-t border-gray-100 pt-4">
          <ReviewerPaperworkForm
            action={uploadReviewerPaperworkAction.bind(null, app.id)}
            categories={REVIEWER_PAPERWORK_TYPES}
          />
        </div>
      </div>
    ),
    // 3 · Sent — awaiting install (dealer returns signed docs)
    await: null,
    // 4 · Review signed documents
    review: (
      <div className="space-y-6">
        {app.serialNumbers.length > 0 && (
          <div>
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
        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-1 text-sm font-medium text-gray-700">Funding verification</h3>
          <p className="mb-3 text-xs text-gray-500">
            Confirm each item before funding. Flagging a problem sends a note to the dealer.
          </p>
          <VerificationChecklist
            applicationId={app.id}
            items={verificationItems}
            states={verificationStates}
          />
        </div>
        <div className="border-t border-gray-100 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Confirmation call</h3>
            <ConfirmationBadge status={app.confirmationStatus} />
          </div>
          <p className="mb-4 text-xs text-gray-500">UEI confirmation script — work through it on the call, check all six boxes, then Confirm.</p>
          <ConfirmationForm
            applicationId={app.id}
            data={app.confirmation}
            applicantName={`${app.applicantFirstName} ${app.applicantLastName}`}
            defaultProduct={app.productsSold.length ? app.productsSold.join(', ') : PROGRAM_CATEGORY_LABELS[app.programCategory]}
            defaultCity={app.loanApplication?.city ?? ''}
            defaultPhone={app.applicantPhone}
            defaultAmount={(app.approvedAmount ?? app.requestedAmount).toString()}
          />
        </div>
      </div>
    ),
    // 5 · Submit to finance company
    submit: (
      <div>
        <DealReferencesForm
          applicationId={app.id}
          financeItNumber={app.financeItNumber}
          hdReference={app.hdReference}
          financed={dealFinanced}
          hdRequired={hdReferenceRequired(app.programType)}
        />
        {missingRequiredReferences({ ...app, financed: dealFinanced }).length === 0 && (
          <WriteToJournalButton
            applicationId={app.id}
            syncedAt={app.journalSyncedAt ? app.journalSyncedAt.toISOString() : null}
            tab={app.journalTab}
            row={app.journalRow}
          />
        )}
        {dealFinanced && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            {app.financeNumberVerifiedAt ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="badge bg-green-100 text-green-800">✓ Financing # verified</span>
                  <form action={toggleFinanceNumberVerifiedAction.bind(null, app.id)}>
                    <button type="submit" className="text-xs text-gray-500 hover:underline">Undo</button>
                  </form>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  by {app.financeNumberVerifiedBy?.name ?? '—'} · {app.financeNumberVerifiedAt.toLocaleString('en-CA')}
                </p>
              </>
            ) : (
              <>
                <form action={toggleFinanceNumberVerifiedAction.bind(null, app.id)}>
                  <button type="submit" className="btn-secondary text-xs" disabled={!app.financeItNumber}>
                    Verify financing number
                  </button>
                </form>
                <p className="mt-1 text-xs text-gray-400">
                  {app.financeItNumber
                    ? 'Confirm the FinanceIT number is valid to solidify this approval.'
                    : 'Add the financing deal number first, then verify it.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    ),
    // 6 · Awaiting funding
    funding: null,
    // 7 · Pay dealer
    pay: (
      <div>
        <div className="mb-5">
          <PayoutReceipt payouts={app.payouts} />
        </div>
        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Record a payout</h3>
          <PayoutForm applicationId={app.id} />
        </div>
      </div>
    ),
  };

  const phaseSummary: Record<string, string> = {
    decide: 'Decision recorded',
    produce: `${reviewerDocs.length} document${reviewerDocs.length === 1 ? '' : 's'} sent to the dealer`,
    await: 'Signed package received',
    review: 'Documents reviewed',
    submit: 'Submitted to the finance company',
    funding: 'Funded',
    pay: 'Paid',
  };

  const phaseAuto: Record<string, string> = {
    decide: 'Approving sets the deal to Approved — the dealer sees "Approved — preparing your documents."',
    produce: 'When the dealer returns the signed package, the deal moves to review on its own.',
    review: 'Confirm every item to send the deal for funding — the dealer sees "Submitted to finance company."',
    submit: 'Sending it in sets the status to In for funding.',
    pay: 'Recording the payout completes the deal.',
  };

  const phases = reviewerPhaseStates(flowSignals).map((p) => ({
    ...p,
    body: phaseBody[p.id],
    summary: phaseSummary[p.id],
    autoNote: p.state === 'done' ? undefined : phaseAuto[p.id],
  }));

  // Notes + history — always available, not tied to a phase.
  const comms = (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Notes to dealer</h3>
        <p className="mb-3 text-xs text-gray-500">Visible to the dealer on this deal.</p>
        <div className="mb-4">
          <NoteThread notes={dealerNotes} emptyText="No messages with the dealer yet." />
        </div>
        <NoteForm
          action={addStaffNoteAction}
          hidden={{ applicationId: app.id, internal: 'false' }}
          placeholder="Write a note to the dealer…"
          label="Send to dealer"
          templates={noteTemplates}
        />
      </div>
      <div className="rounded-lg border border-amber-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Internal notes</h3>
        <p className="mb-3 text-xs text-amber-700">Only Reviewers and Admins can see these — never shown to the dealer.</p>
        <div className="mb-4">
          <NoteThread notes={internalNotes} emptyText="No internal notes yet." />
        </div>
        <NoteForm
          action={addStaffNoteAction}
          hidden={{ applicationId: app.id, internal: 'true' }}
          placeholder="Internal note (staff only)…"
          label="Add internal note"
          templates={noteTemplates}
        />
      </div>
      <div className="border-t border-gray-100 pt-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">History</h3>
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
      </div>
      <div className="border-t border-gray-100 pt-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Activity log</h3>
        <p className="mb-3 text-xs text-gray-500">Everything that happened on this deal, and which team member did it.</p>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2 last:border-0">
                <span>
                  <span className="font-medium text-gray-800">{e.actor?.name ?? e.actorName ?? 'System'}</span>
                  <span className="text-gray-600"> — {actionLabel(e.action)}</span>
                  {e.detail && <span className="ml-1 text-gray-400">({e.detail})</span>}
                </span>
                <span className="flex-none text-xs text-gray-400">{e.createdAt.toLocaleString('en-CA')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {app.decisions.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Decision log</h3>
          <ul className="space-y-2 text-sm">
            {app.decisions.map((d) => (
              <li key={d.id} className="rounded border border-gray-100 bg-gray-50 p-2">
                <span className="font-medium">{d.type.replace('_', ' ')}</span>
                {d.notes && <p className="text-gray-600">{d.notes}</p>}
                <p className="text-xs text-gray-400">{d.decidedBy.name} · {d.createdAt.toLocaleString('en-CA')}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {app.consents.length > 0 && (
        <div className="border-t border-gray-100 pt-4 text-xs text-gray-500">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Consent</h3>
          <p>Captured {app.consents[0].capturedAt.toLocaleString('en-CA')}</p>
          <p>Policy version: {app.consents[0].policyVersion}</p>
          {app.consents[0].ipAddress && <p>IP: {app.consents[0].ipAddress}</p>}
        </div>
      )}
    </div>
  );

  // Persistent right rail — the decision/action controls, always in reach.
  const rail = (
    <section className="card p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Decision</h2>
      {app.status === 'SUBMITTED' && (
        <form action={startReview} className="mb-4">
          <button type="submit" className="btn-secondary w-full">Start review</button>
        </form>
      )}
      {options.some((o) => o.value === 'FUND') && !verificationComplete && (
        <p className="mb-4 rounded bg-amber-50 p-2 text-xs text-amber-800">
          Complete the funding verification checklist (every item Confirmed) before this deal can be funded.
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
          The flow sets the status for you as you work. Use this only to jump back or flag a Problem.
        </p>
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/staff" className="text-sm text-gray-500 hover:underline">← Back to queue</Link>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-gray-900">
              <ProgramBadge type={app.programType} category={PROGRAM_CATEGORY_LABELS[app.programCategory]} size="lg" />
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

        {app.taxExempt && (() => {
          const ex = exemptionSummary({ taxExempt: true, province: app.province, deliveredToReserve: app.deliveredToReserve });
          const statusCard = reveal ? (decryptOptional(app.statusCardNumberEnc) ?? '—') : masked(app.statusCardNumberEnc);
          return (
            <section className="card border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge bg-amber-200 text-amber-900">🪶 Tax exempt · {ex.label}</span>
                <span className="text-sm text-amber-900">{ex.detail}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-gray-500">Status card #</dt><dd className="font-medium">{statusCard}{!reveal && app.statusCardNumberEnc && <a href={`/staff/applications/${app.id}?reveal=1`} className="ml-2 text-xs text-brand-600 hover:underline">reveal</a>}</dd></div>
                <div><dt className="text-gray-500">Band / First Nation</dt><dd className="font-medium">{app.bandName ?? '—'}</dd></div>
                <div><dt className="text-gray-500">On reserve</dt><dd className="font-medium">{app.deliveredToReserve ? 'Yes' : 'No'}</dd></div>
                <div><dt className="text-gray-500">Province</dt><dd className="font-medium">{app.province}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-amber-800">Verify the status card and register this exemption with Home Depot before final payment (see the funding verification checklist).</p>
            </section>
          );
        })()}

      <ReviewerWorkspace
        phases={phases}
        comms={comms}
        rail={rail}
        dealerStatus={dealerStatus}
      />
    </div>
  );
}
