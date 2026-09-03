import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { requireStaffSection } from '@/lib/session';
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
import { ReviewerPaperworkBoxes } from './ReviewerPaperworkBoxes';
import { ReviewerDoneButton } from './ReviewerDoneButton';
import { FundingStepActions } from './FundingStepActions';
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
import { reviewerPhaseStates, dealerFacingStatus, currentPhaseIndex, hasDealerReturned, type PhaseState } from '@/lib/reviewerFlow';
import { exemptionSummary } from '@/lib/tax';
import { dealHasFinancing, financedAmountOf } from '@/lib/payments';
import { journalEnabled } from '@/lib/journal';
import { PaymentBreakdown } from '@/components/PaymentBreakdown';
import {
  startReviewAction,
  uploadReviewerPaperworkAction,
  addStaffNoteAction,
  deleteDocumentAction,
} from '@/app/(staff)/actions';
import { VerifyFinanceNumberButton } from '@/components/VerifyFinanceNumberButton';
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
  const user = await requireStaffSection('review-queue');
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

  // Full mailing address for paperwork. City / province / postal are plaintext
  // and always shown — sourced from the loan application, falling back to the
  // Application-level fields so Express / Photo deals (no loan record) show them
  // too. The street stays behind the audited reveal, then joins in.
  const nz = (v?: string | null) => (v && v.trim() ? v.trim() : null);
  const addrCity = nz(loan?.city) ?? nz(app.applicantCity);
  const addrProv = nz(loan?.addressProvince) ?? nz(app.province);
  const addrPostal = nz(loan?.postalCode) ?? nz(app.applicantPostal);
  const cityProvPostal = [[addrCity, addrProv].filter(Boolean).join(', '), addrPostal].filter(Boolean).join(' ');
  const streetShown = reveal && pv.address !== '—' ? pv.address : null;
  const fullAddress = [streetShown, cityProvPostal].filter(Boolean).join(', ');

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

  // When the install paperwork first went out (earliest reviewer-stage doc).
  // Anything the dealer uploads AFTER this point is a returned document, even if
  // it lands in the "Documents for approval" box instead of the funding package.
  const installSentAt = reviewerDocs.length
    ? reviewerDocs.reduce((min, d) => (d.createdAt < min ? d.createdAt : min), reviewerDocs[0].createdAt)
    : null;
  const returnedApplicationDocs = installSentAt
    ? applicationDocs.filter((d) => d.createdAt > installSentAt)
    : [];
  // The deal has heard back from the dealer if a funding-package doc arrived OR
  // the dealer added anything new since the paperwork was sent — so a return
  // uploaded to the wrong place still advances the flow to "Review".
  const dealerReturnedDocs = hasDealerReturned(app.documents);

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
    fundingDocsReceived: dealerReturnedDocs,
    // Paid = a recorded payout OR the journal showing the deal settled (paid).
    hasPayouts: app.payouts.length > 0 || !!app.journalPaidOn,
  };
  const dealerStatus = dealerFacingStatus(flowSignals);
  const dealFinanced = dealHasFinancing(app);
  const financedAmt = financedAmountOf(app);

  // Deal numbers + journal sync. Captured at decision time (recorded on the deal
  // and used for funding), so it lives at the top of Review & decide.
  // How the deal was paid + what the finance company funds. A reviewer needs the
  // financed amount before anything else, so it leads the Review & decide flow.
  const paymentBreakdownSection =
    app.isSplitPayment && app.paymentSplits.length > 0 ? (
      <PaymentBreakdown
        splits={app.paymentSplits}
        total={Number(app.approvedAmount ?? app.requestedAmount)}
        financed={financedAmt}
      />
    ) : null;

  // A deal is "decided" (and belongs in the journal) once it's approved or
  // beyond. The journal is seeded at approval and re-synced on every change, so
  // its status shows from approval on — not held back until every number is in.
  const decided = (['CONDITIONAL', 'APPROVED', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'] as ApplicationStatus[]).includes(app.status);
  // Rule: an HD deal can't send install paperwork until its HD Customer # is in.
  const hdBlocksPaperwork = hdReferenceRequired(app.programType) && !app.hdReference?.trim();

  const dealNumbersSection = (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Deal numbers</h3>
      {journalEnabled() && (
        <p className="mb-3 -mt-1 text-xs text-gray-400">
          Saved numbers sync to the sales journal automatically on approval and whenever you change them.
        </p>
      )}
      <DealReferencesForm
        applicationId={app.id}
        financeItNumber={app.financeItNumber}
        hdReference={app.hdReference}
        financed={dealFinanced}
        hdRequired={hdReferenceRequired(app.programType)}
      />
      {journalEnabled() && decided && (
        <WriteToJournalButton
          applicationId={app.id}
          syncedAt={app.journalSyncedAt ? app.journalSyncedAt.toISOString() : null}
          tab={app.journalTab}
          row={app.journalRow}
        />
      )}
      {dealFinanced && (
        <VerifyFinanceNumberButton
          applicationId={app.id}
          verified={!!app.financeNumberVerifiedAt}
          canVerify={!!app.financeItNumber}
          verifiedByName={app.financeNumberVerifiedBy?.name ?? null}
          verifiedAt={app.financeNumberVerifiedAt ? app.financeNumberVerifiedAt.toLocaleString('en-CA') : null}
        />
      )}
    </div>
  );

  // Decision + status controls. Previously these lived in a separate right-hand
  // column; folding them into the top of "Review & decide" makes the whole step
  // read as one flow — make the call here (approve / decline / request docs),
  // change it later, or jump the status by hand.
  const decisionSection = (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Decision</h3>
      {app.status === 'SUBMITTED' && (
        <form action={startReview} className="mb-4">
          <button type="submit" className="btn-secondary w-full sm:w-auto">Start review</button>
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
        defaultFinanceCompanyId={app.financeCompanyId}
        defaultFinanceItNumber={app.financeItNumber}
        defaultHdReference={app.hdReference}
        hdRequired={hdReferenceRequired(app.programType)}
      />
      <div className="mt-5 border-t border-gray-100 pt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Change status</h4>
        <StatusChangeForm applicationId={app.id} current={app.status} />
        <p className="mt-2 text-xs text-gray-400">
          The flow sets the status for you as you work. Use this to jump back, change the decision, or flag a Problem.
        </p>
      </div>
    </div>
  );

  const phaseBody: Record<string, ReactNode> = {
    // 1 · Review & decide
    decide: (
      <div className="space-y-6">
        {paymentBreakdownSection}
        {decisionSection}
        {dealNumbersSection}
        <CollapsibleEntry
          storageKey={`entryview:${app.id}`}
          snapshot={
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 [&>div]:min-w-0 [&_dd]:break-words">
              <div><dt className="text-gray-500">Program</dt><dd><ProgramBadge type={app.programType} category={PROGRAM_CATEGORY_LABELS[app.programCategory]} /></dd></div>
              <div><dt className="text-gray-500">Customer</dt><dd className="font-medium">{app.applicantFirstName} {app.applicantLastName}</dd></div>
              <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{app.applicantPhone}</dd></div>
              <div className="sm:col-span-2"><dt className="text-gray-500">Address</dt><dd className="font-medium">{fullAddress || '—'}{!reveal && app.applicantAddressEnc && <a href={`/staff/applications/${app.id}?reveal=1`} className="ml-2 text-xs font-normal text-brand-600 hover:underline">reveal street</a>}</dd></div>
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
        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Application documents</h3>
          <DocumentList documents={applicationDocs} deleteAction={deleteDocumentAction} />
        </div>
      </div>
    ),
    // 2 · Produce install documents
    produce: (
      <div>
        {hdBlocksPaperwork ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-900">Add the HD Customer # first</p>
            <p className="mt-1 text-amber-800">
              This HD deal needs its HD Customer # before install paperwork can go to the dealer. Add it under{' '}
              <strong>Review &amp; decide → Deal numbers</strong> (it also writes to the sales journal), then send the documents here.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-xs text-gray-500">Upload paperwork the dealer can view and download — send as many as you need, now or later. Files are converted to PDF.</p>
            <div className="mb-4">
              <DocumentList documents={reviewerDocs} deleteAction={deleteDocumentAction} />
            </div>
            <div className="border-t border-gray-100 pt-4">
              <ReviewerPaperworkBoxes
                action={uploadReviewerPaperworkAction.bind(null, app.id)}
                categories={REVIEWER_PAPERWORK_TYPES}
                scope={app.id}
              />
            </div>
          </>
        )}
      </div>
    ),
    // 3 · Sent — awaiting install. Not a dead "waiting" step: the reviewer often
    // needs to send more than one document, so keep the paperwork sender open
    // here too. Sending the first doc no longer closes off adding the rest.
    await: (
      <div>
        <ReviewerDoneButton
          applicationId={app.id}
          doneAt={app.reviewerDoneAt ? app.reviewerDoneAt.toISOString() : null}
          doneByName={app.reviewerDoneByName}
        />
        <p className="mb-4 text-xs text-gray-500">
          Waiting on the dealer&apos;s signed package. You can still send more paperwork below — the deal moves to review on its own the moment the dealer sends anything back.
        </p>
        <div className="mb-2 text-sm font-medium text-gray-700">Documents you&apos;ve sent the dealer</div>
        <div className="mb-4">
          <DocumentList documents={reviewerDocs} deleteAction={deleteDocumentAction} />
        </div>
        <div className="border-t border-gray-100 pt-4">
          <ReviewerPaperworkBoxes
            action={uploadReviewerPaperworkAction.bind(null, app.id)}
            categories={REVIEWER_PAPERWORK_TYPES}
            scope={app.id}
          />
        </div>
      </div>
    ),
    // 4 · Review signed documents
    review: (
      <div className="space-y-6">
        {returnedApplicationDocs.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <h3 className="mb-1 text-sm font-medium text-amber-900">Returned by the dealer</h3>
            <p className="mb-2 text-xs text-amber-700">
              These arrived in the dealer&apos;s &ldquo;Documents for approval&rdquo; area after the install paperwork went out — treat them as part of the signed package.
            </p>
            <DocumentList documents={returnedApplicationDocs} deleteAction={deleteDocumentAction} />
          </div>
        )}
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
        <FundingChecklist fundingDocs={fundingDocs} applicationId={app.id} status={app.status} programType={app.programType} paymentMethod={app.paymentMethod} isSplitPayment={app.isSplitPayment} />
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
      </div>
    ),
    // 5 · Confirmation call — its own step (often done later, added to over time)
    confirm: (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Confirmation call</h3>
          <ConfirmationBadge status={app.confirmationStatus} />
        </div>
        <p className="mb-4 text-xs text-gray-500">Confirmation script — work through it on the call, check all six boxes, then Confirm. You can open this any time and add to it as the call happens.</p>
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
    ),
    // 6 · Submit to finance company
    submit: (
      <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
        Deal numbers and the journal are recorded up at <strong>Review &amp; decide</strong>. Send the deal to the
        finance company, then mark it in for funding.
      </p>
    ),
    // 7 · Awaiting funding — the Mark Funded button, but only once the deal has
    // actually reached "in for funding" (not on an earlier phase).
    funding: app.status === 'FUNDING_REVIEW'
      ? <FundingStepActions applicationId={app.id} journalCheckedAt={app.journalCheckedAt ? app.journalCheckedAt.toISOString() : null} />
      : null,
    // 8 · Pay dealer
    pay: (
      <div>
        {app.journalPaidOn && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="font-semibold">Sales journal:</span> this deal is marked <strong>OK &amp; paid</strong> on{' '}
            {app.journalPaidOn.toLocaleDateString('en-CA')}. Record the dealer payout below to complete the disbursement.
          </div>
        )}
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
    confirm: 'Confirmation call complete',
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

  // The confirmation call runs on its own clock — it's Done once confirmed, and
  // otherwise available (You're here) as soon as the deal reaches the review
  // stage, so a reviewer can add to it whenever the call actually happens.
  const reviewReached = currentPhaseIndex(flowSignals) >= 4;
  const confirmState: PhaseState =
    app.confirmationStatus === 'COMPLETED' ? 'done' : reviewReached ? 'now' : 'todo';

  // A deal can be auto-approved (e.g. dealer/FinanceIT), which jumps the flow past
  // "Review & decide" — so the reviewer can miss recording the HD / loan number.
  // Flag it: force that phase open and show a top-of-page prompt until the
  // required number(s) are in.
  const missingRefs = missingRequiredReferences({
    hdReference: app.hdReference,
    financeItNumber: app.financeItNumber,
    financed: dealFinanced,
    programType: app.programType,
  });
  const deadEnd = app.status === 'DECLINED' || app.status === 'WITHDRAWN';
  const decideNeedsRefs =
    missingRefs.length > 0 && currentPhaseIndex(flowSignals) > 1 && !deadEnd;
  const refsList = missingRefs.length === 2 ? `${missingRefs[0]} and ${missingRefs[1]}` : missingRefs[0];
  const reviewAlert = decideNeedsRefs
    ? { message: `This deal is already approved but still needs ${refsList}. Open “Review & decide” below and record it before producing the install documents.` }
    : null;

  const phases = reviewerPhaseStates(flowSignals).map((p) => {
    const state = p.id === 'confirm' ? confirmState : p.state;
    return {
      ...p,
      state,
      body: phaseBody[p.id],
      summary: phaseSummary[p.id],
      autoNote: state === 'done' ? undefined : phaseAuto[p.id],
      attention: p.id === 'decide' ? decideNeedsRefs : undefined,
    };
  });

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
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 [&>div]:min-w-0 [&_dd]:break-words">
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
        dealerStatus={dealerStatus}
        alert={reviewAlert}
      />
    </div>
  );
}
