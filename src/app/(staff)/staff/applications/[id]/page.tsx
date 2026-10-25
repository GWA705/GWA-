import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { decryptOptional } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentList } from '@/components/DocumentList';
import { DownloadButton } from '@/components/DownloadButton';
import { HdWaiverCard } from '@/components/HdWaiverCard';
import { FundingChecklist } from '@/components/FundingChecklist';
import { VerificationChecklist, type VerificationState } from '@/components/VerificationChecklist';
import { ReviewerEntryView } from '@/components/ReviewerEntryView';
import { HdEntrySheet, type HdSection } from '@/components/HdEntrySheet';
import { CollapsibleEntry } from '@/components/CollapsibleEntry';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { PayoutReceipt } from '@/components/PayoutReceipt';
import { ReviewerPaperworkBoxes } from './ReviewerPaperworkBoxes';
import { ReviewerDoneButton } from './ReviewerDoneButton';
import { FundingStepActions } from './FundingStepActions';
import { NoteThread } from '@/components/NoteThread';
import { NoteForm } from '@/components/NoteForm';
import { ConversationThread } from '@/components/ConversationThread';
import { ConfirmationBadge } from '@/components/ConfirmationBadge';
import { ConfirmationIssueBanner } from '@/components/ConfirmationIssueBanner';
import { loadConfirmationIssue } from '@/lib/confirmationIssue';
import { DealProgress } from '@/components/DealProgress';
import { ProgramBadge } from '@/components/ProgramBadge';
import {
  PROGRAM_CATEGORY_LABELS,
  dealIsFinanced,
  financeCompanyDisplay,
  hdReferenceRequired,
  missingRequiredReferences,
} from '@/lib/constants';
import { programCategoryLabel, paymentMethodLabel } from '@/lib/enumLabels';
import { getT } from '@/i18n/server';
import { ConfirmationForm } from './ConfirmationForm';
import { FinanceitPullButton } from './FinanceitPullButton';
import { CallAttemptLog } from './CallAttemptLog';
import { financeitEmailConfigured } from '@/lib/financeitEmail';
import { CallRecordingPanel } from './CallRecordingPanel';
import { DealReferencesForm } from './DealReferencesForm';
import { WriteToJournalButton } from './WriteToJournalButton';
import { DecisionForm } from './DecisionForm';
import { PayoutForm } from './PayoutForm';
import { StatusChangeForm } from './StatusChangeForm';
import { CancellationReviewCard, type CancellationReviewVM } from './CancellationReviewCard';
import { ReactivateDealCard } from './ReactivateDealCard';
import { BookingActivityCard } from './BookingActivityCard';
import { ReviewerWorkspace } from './ReviewerWorkspace';
import { reviewerPhaseStates, dealerFacingStatusLabel, currentPhaseIndex, hasDealerReturned, type PhaseState } from '@/lib/reviewerFlow';
import { exemptionSummary, netBeforeTax } from '@/lib/tax';
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
import { REVIEWER_PAPERWORK_TYPES, applicableVerificationChecks, decisionTone } from '@/lib/constants';
import { isOutOfBandReturn } from '@/lib/outOfBandReturn';
import { diagnoseFundingSubmit } from '@/lib/fundingSubmitStatus';
import { AdvanceToFundingButton } from './AdvanceToFundingButton';
import { ReviewRequestCard } from './ReviewRequestCard';
import { FlagDealerIssueCard } from './FlagDealerIssueCard';
import { EmailDocsCard } from './EmailDocsCard';
import { getReviewLink } from '@/lib/settings';
import { smsEnabled } from '@/lib/sms';
import { voiceEnabled } from '@/lib/voice';
import { computeDealerPayout } from '@/lib/payoutCalc';
import { decisionDisplayLabel } from '@/lib/enumLabels';
import type { ApplicationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Friendly wording for each audit action shown in the deal activity log.
// Values are i18n keys under staffDeal.activity.actions.
const ACTION_LABEL_KEYS: Record<string, string> = {
  APPLICATION_CREATE: 'staffDeal.activity.actions.created',
  APPLICATION_SUBMIT: 'staffDeal.activity.actions.submitted',
  APPLICATION_UPDATE: 'staffDeal.activity.actions.updated',
  PII_DECRYPT: 'staffDeal.activity.actions.piiDecrypt',
  DECISION: 'staffDeal.activity.actions.decision',
  STATUS_CHANGE: 'staffDeal.activity.actions.statusChange',
  DOC_UPLOAD: 'staffDeal.activity.actions.docUpload',
  DOC_DOWNLOAD: 'staffDeal.activity.actions.docDownload',
  JOURNAL_WRITE: 'staffDeal.activity.actions.journalWrite',
  FUNDING_SUBMIT: 'staffDeal.activity.actions.fundingSubmit',
  FUNDING_DECISION: 'staffDeal.activity.actions.fundingDecision',
};

function actionLabel(t: ReturnType<typeof getT>, action: string): string {
  const key = ACTION_LABEL_KEYS[action];
  return key ? t(key) : action.replace(/_/g, ' ').toLowerCase();
}

function decisionOptions(t: ReturnType<typeof getT>, status: ApplicationStatus): { value: string; label: string }[] {
  if (['SUBMITTED', 'UNDER_REVIEW', 'CONDITIONAL'].includes(status)) {
    return [
      { value: 'APPROVE', label: t('staffDeal.decisionOptions.approve') },
      { value: 'CONDITIONAL', label: t('staffDeal.decisionOptions.conditional') },
      { value: 'REQUEST_DOCS', label: t('staffDeal.decisionOptions.requestDocs') },
      { value: 'DECLINE', label: t('staffDeal.decisionOptions.decline') },
    ];
  }
  if (['FUNDING_SUBMITTED', 'FUNDING_REVIEW'].includes(status)) {
    return [{ value: 'FUND', label: t('staffDeal.decisionOptions.fund') }];
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
  const t = getT();
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
      confirmationAttempts: { orderBy: { createdAt: 'asc' }, include: { createdBy: { select: { name: true } } } },
      verificationChecks: { include: { checkedBy: true } },
      paymentSplits: { orderBy: { sortOrder: 'asc' } },
      cancellations: { orderBy: { createdAt: 'desc' }, take: 1, include: { requestedBy: true, handledBy: true } },
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

  // Internal notes, newest first — so the latest note any reviewer adds lands at
  // the top of the panel we pin near the top of the profile.
  const internalNotes = app.dealNotes
    .filter((n) => n.internal)
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Flagged confirmation issue → top banner with its acknowledgement state.
  const confirmationIssue = await loadConfirmationIssue(app.confirmationIssueMailId);

  const reveal = searchParams.reveal === '1';

  // Protected identity fields (DOB, street address, government ID number — SIN
  // and banking are not collected) are shown masked, and decrypted only when
  // the reviewer explicitly reveals them (which is audited). This lets the
  // reviewer read the whole application straight down when re-keying it into a
  // lender's portal. A masked value shows dots when present, an em dash when the
  // field is empty.
  const masked = (enc: string | null | undefined) => (enc ? '••••••' : '—');
  const loan = app.loanApplication;
  // Log the PII access BEFORE decrypting, and only reveal if the audit entry was
  // actually written — a reveal must never happen without a record of it. If the
  // audit write fails, fall back to the masked view.
  const revealOk = reveal
    ? await audit({
        actorId: user.userId,
        action: 'PII_DECRYPT',
        entityType: 'Application',
        entityId: app.id,
        detail: 'Revealed identity fields (reviewer entry view)',
      })
    : false;
  const pv = revealOk
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
  const streetShown = revealOk && pv.address !== '—' ? pv.address : null;
  const fullAddress = [streetShown, cityProvPostal].filter(Boolean).join(', ');

  // "Copy to Home Depot" sheet: the two HD screens we re-key by hand, laid out in
  // field order so staff copy instead of retype. Page 1 is the lead / customer
  // entry; page 2 is the "Proposal and Agreement" (the install contract). Text is
  // pre-cased to match HD (UPPERCASE, email as-is). HD's own system IDs (Customer
  // / Lead ID / Service ID) are assigned by Home Depot, so they aren't copied from
  // us. The street stays behind the audited reveal.
  const hdUp = (s?: string | null) => (s && s.trim() ? s.trim().toUpperCase() : null);
  // HD phone fields want +1XXXXXXXXXX. Fall back to the raw value when it isn't a
  // clean 10/11-digit number.
  const hdPhone = (s?: string | null) => {
    const d = (s || '').replace(/\D/g, '');
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith('1')) return `+${d}`;
    return s?.trim() || null;
  };
  const fmtMdy = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  const hdStoreValue = app.homeDepotStore
    ? `${app.homeDepotStore.name ? `${app.homeDepotStore.name} - ` : ''}${app.homeDepotStore.number}`.toUpperCase()
    : null;
  const hdInstall = app.installationDate ? fmtMdy(app.installationDate) : null;
  // The proposal/signing date — date of sale when we have it, else today (the day
  // staff produce the paperwork).
  const hdSaleDate = app.dateOfSale ? fmtMdy(app.dateOfSale) : fmtMdy(new Date());
  const hdFullName = hdUp([app.applicantFirstName, app.applicantLastName].filter((p) => p && p.trim()).join(' '));
  const hdInitials =
    [app.applicantFirstName, app.applicantLastName]
      .map((n) => (n && n.trim() ? n.trim()[0].toUpperCase() : ''))
      .join('') || null;
  const hdProducts = app.productsSold.length ? `SUPPLY AND INSTALL ${app.productsSold.join(' AND ').toUpperCase()}` : null;

  // The sale total we hold is tax-INCLUDED. HD wants the pre-tax net in the lead's
  // "Retail Value" and the agreement's "Products/Sub Total", the tax split across
  // the HST/GST/PST boxes by province, and the tax-included total in the
  // agreement's "Total Payable"/"Payment #1".
  const hdSaleTotal = Number(app.approvedAmount ?? app.requestedAmount) || 0;
  const hdNet = netBeforeTax(hdSaleTotal, app.province);
  const hasAmount = hdSaleTotal > 0;
  const money2 = (n: number) => n.toFixed(2); // HD's charge boxes take plain numbers, no commas
  const hdRetail = hasAmount
    ? hdNet.net.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;
  // Split the tax into HD's three boxes: HST provinces put it all in H.S.T.;
  // everywhere else the federal 5% GST goes in GST/TPS and any provincial part
  // (BC/MB/SK PST, QC QST) in PST/TVQ. GST-only provinces leave PST blank.
  const HD_HST_PROVINCES = new Set(['ON', 'NB', 'NL', 'NS', 'PE']);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const hdTax = (() => {
    if (!hasAmount || hdNet.rate <= 0) return { hst: 0, gst: 0, pst: 0 };
    if (HD_HST_PROVINCES.has(app.province)) return { hst: hdNet.tax, gst: 0, pst: 0 };
    const gst = round2(hdNet.net * 0.05);
    return { hst: 0, gst, pst: round2(hdNet.tax - gst) };
  })();

  const hdSections: HdSection[] = [
    // ——— Page 1: lead / customer entry ———
    { title: 'Lead — Customer Details', fields: [
      { label: 'First Name', value: hdUp(app.applicantFirstName) },
      { label: 'Last Name', value: hdUp(app.applicantLastName) },
      { label: 'Street Address', value: hdUp(streetShown), missingHint: 'Reveal the street first (link above)' },
      { label: 'City', value: hdUp(addrCity) },
      { label: 'Region', value: hdUp(addrProv) },
      { label: 'Country', value: 'CA' },
      { label: 'Postal Code', value: hdUp(addrPostal) },
      { label: 'Phone Number', value: app.applicantPhone?.trim() || null },
      { label: 'Cell Phone', value: app.applicantPhone?.trim() || null },
      { label: 'E-Mail', value: app.applicantEmail?.trim() || null },
      { label: 'Language', value: 'EN' },
    ] },
    { title: 'Lead — Lead Details', fields: [
      { label: 'Store', value: hdStoreValue },
      { label: 'Service Provider', value: 'Georgian Water & Air' },
      { label: 'Origin', value: 'Service Provider' },
      { label: 'Install Start Date', value: hdInstall },
      { label: 'Install End Date', value: hdInstall },
      { label: 'Notes', value: hdProducts },
      { label: 'Status', value: 'Sold' },
      { label: 'Retail Value', value: hdRetail },
      { label: 'HD reference (ours)', value: app.hdReference?.trim() || null },
    ] },
    // ——— Page 2: Proposal and Agreement (the install contract) ———
    { title: 'Agreement — Customer', fields: [
      { label: 'Customer Name', value: hdFullName },
      { label: 'Installation Address', value: hdUp(streetShown), missingHint: 'Reveal the street first (link above)' },
      { label: 'City', value: hdUp(addrCity) },
      { label: 'Province', value: hdUp(addrProv) },
      { label: 'Postal Code', value: hdUp(addrPostal) },
      { label: 'Day Phone', value: hdPhone(app.applicantPhone) },
      { label: 'Evening Phone', value: hdPhone(app.applicantPhone) },
      { label: 'Date', value: hdSaleDate },
    ] },
    { title: 'Agreement — Service Provider', fields: [
      // GWA's fixed provider-record values as entered in HD's portal — these match
      // Home Depot's existing service-provider record (not the brand-kit print
      // block); the fax is a placeholder HD's form requires.
      { label: 'Service Provider Representative', value: 'Georgian Water & Air' },
      { label: 'Service Provider Name', value: 'Georgian Water & Air' },
      { label: 'Phone No.', value: '+17058120320' },
      { label: 'Service Provider Address', value: '11 King St, Unit 10' },
      { label: 'Fax No.', value: '+19999999999' },
    ] },
    { title: 'Agreement — Charges', fields: [
      { label: 'Description of Products', value: hdProducts },
      { label: 'Commencement Date', value: hdInstall },
      { label: 'Products and Services $', value: hasAmount ? money2(hdNet.net) : null },
      { label: 'Promo Discount $', value: hasAmount ? '0.00' : null },
      { label: 'Sub Total $', value: hasAmount ? money2(hdNet.net) : null },
      { label: 'H.S.T. $', value: hdTax.hst > 0 ? money2(hdTax.hst) : null },
      { label: 'GST/TPS $', value: hdTax.gst > 0 ? money2(hdTax.gst) : null },
      { label: 'PST/TVQ $', value: hdTax.pst > 0 ? money2(hdTax.pst) : null },
      { label: 'Total Payable $', value: hasAmount ? money2(hdSaleTotal) : null },
      { label: 'Payment #1 $', value: hasAmount ? money2(hdSaleTotal) : null },
    ] },
    { title: 'Agreement — Signatures', fields: [
      { label: "Buyer's Signature", value: hdFullName },
      { label: 'Date Signed', value: hdSaleDate },
      { label: 'Signed at Location', value: hdUp(addrCity) },
      { label: "Service Provider's Authorized Signature", value: 'SEAN JAIKO' },
      { label: 'SP Date Signed', value: hdSaleDate },
      { label: 'SP Signed at Location', value: 'BARRIE' },
      { label: 'Initials', value: hdInitials },
      { label: 'Date', value: hdSaleDate },
    ] },
  ];

  const applicationDocs = app.documents.filter((d) => d.stage === 'APPLICATION');
  const fundingDocs = app.documents.filter((d) => d.stage === 'FUNDING');
  const reviewerDocs = app.documents.filter((d) => d.stage === 'REVIEWER');

  // Customer review request (confirmation step): is a review link configured, and
  // can this user set it (admins only)?
  const reviewLink = await getReviewLink();
  // Product Library files (manuals / brochures / spec sheets) that can be emailed
  // to the customer — from the ResourceProduct catalog, not the internal content.
  const RESOURCE_FILE_KIND_LABELS: Record<string, string> = {
    MANUAL: t('staffDeal.resourceKind.manual'),
    BROCHURE: t('staffDeal.resourceKind.brochure'),
    SPEC_SHEET: t('staffDeal.resourceKind.specSheet'),
    WARRANTY: t('staffDeal.resourceKind.warranty'),
    OTHER: t('staffDeal.resourceKind.file'),
  };
  const libraryDocs = (
    await prisma.resourceProductFile.findMany({
      where: { product: { active: true } },
      select: { id: true, kind: true, label: true, product: { select: { title: true } } },
      orderBy: [{ product: { title: 'asc' } }, { sortOrder: 'asc' }],
    })
  ).map((f) => ({
    id: f.id,
    title: `${f.product.title}${f.label ? ` (${f.label})` : ''}`,
    sectionLabel: RESOURCE_FILE_KIND_LABELS[f.kind] ?? t('staffDeal.resourceKind.file'),
  }));

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

  // Make the hold-up visible to the reviewer: when a DOCS_SENT deal has its
  // signed package back (or a serial is missing), explain why it hasn't moved to
  // funding — mirrors the dealer-side submit gate so there's no mystery.
  const fundingSubmitDiagnosis = diagnoseFundingSubmit({
    status: app.status,
    requiresSerialPerProduct: !!app.financeCompany?.requiresSerialPerProduct,
    productsSold: app.productsSold,
    serialProductLabels: app.serialNumbers.filter((s) => s.value.trim()).map((s) => s.productLabel ?? ''),
    hasReturnedDocs: dealerReturnedDocs,
  });

  // Per-stage completion dates for the reviewer timeline (best-effort, from the
  // status history + records already loaded). Missing ones just render blank.
  const fmtStage = (d: Date | null | undefined) =>
    d ? d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : null;
  const firstEventTo = (statuses: ApplicationStatus[]): Date | null =>
    app.statusEvents
      .filter((e) => statuses.includes(e.to))
      .reduce<Date | null>((min, e) => (min === null || e.createdAt < min ? e.createdAt : min), null);
  const earliestFundingDoc = fundingDocs.length
    ? fundingDocs.reduce((min, d) => (d.createdAt < min ? d.createdAt : min), fundingDocs[0].createdAt)
    : null;
  // Out-of-band return: the dealer sent back signed-package documents while the
  // deal is still Approved/Conditional AND its install documents were never sent
  // through the portal. A deal that WAS sent and later moved back to
  // Approved/Conditional must NOT trip this (that's a normal correction, not
  // out-of-band) — so we also check the reviewer docs + full status history.
  const packageReturnedEarly = isOutOfBandReturn({
    status: app.status,
    fundingDocTypes: fundingDocs.map((d) => d.type),
    statusHistoryTos: app.statusEvents.map((e) => e.to),
  });
  // The out-of-band deal can move to In for funding once its uploaded funding
  // documents are all confirmed.
  const fundingDocsReady = fundingDocs.length > 0 && fundingDocs.every((d) => d.verifiedAt !== null);
  const latestPayout = app.payouts.length
    ? app.payouts.reduce((max, p) => (p.paidOn > max ? p.paidOn : max), app.payouts[0].paidOn)
    : null;
  const stageDates = {
    submitted: fmtStage(app.createdAt),
    approved: fmtStage(firstEventTo(['APPROVED', 'CONDITIONAL'])),
    docs: fmtStage(earliestFundingDoc ?? firstEventTo(['FUNDING_SUBMITTED'])),
    confirmation: fmtStage(app.confirmationStatus === 'COMPLETED' ? app.confirmation?.completedAt ?? null : null),
    funding: fmtStage(firstEventTo(['FUNDING_SUBMITTED', 'FUNDING_REVIEW'])),
    funded: fmtStage(firstEventTo(['FUNDED'])),
    paid: fmtStage(latestPayout),
  };

  // Dealer documents that landed AFTER this deal was finished with the dealer
  // (past review — in funding, funded, or the reviewer marked their step done).
  // A dealer can upload to a completed/funded deal (e.g. a missing Bill of Sale),
  // and because every phase reads "Done" there was no signal it arrived. Surface
  // those late uploads in a banner at the very top of the deal so they can't be
  // missed, no matter the deal's status.
  const completedAt = [app.reviewerDoneAt, firstEventTo(['FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'])]
    .filter((d): d is Date => !!d)
    .reduce<Date | null>((min, d) => (min === null || d < min ? d : min), null);
  const lateDealerDocs = completedAt
    ? app.documents.filter(
        (d) => (d.stage === 'APPLICATION' || d.stage === 'FUNDING') && d.createdAt > (completedAt as Date),
      )
    : [];

  // Split-payment funding progress. HD may pay a split deal in more than one
  // remittance (e.g. a deposit, then the balance). The deal is NOT marked Funded
  // until the total received reaches the expected HD payout — show the reviewer
  // how much has arrived vs expected so a partial payment is obvious.
  let partialFunding: { received: number; expected: number } | null = null;
  if (app.isSplitPayment && app.status !== 'FUNDED') {
    const agg = await prisma.hdRemittanceLine.aggregate({
      where: { applicationId: app.id, isChargeback: false },
      _sum: { amount: true },
    });
    const received = Number(agg._sum.amount ?? 0);
    if (received > 0) {
      const expected = computeDealerPayout(Number(app.approvedAmount ?? app.requestedAmount) || 0, app.province).payout;
      partialFunding = { received, expected };
    }
  }

  const options = decisionOptions(t, app.status);
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
  const dealerStatus = dealerFacingStatusLabel(t, flowSignals);
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
        t={t}
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
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('staffDeal.dealNumbers.title')}</h3>
      {journalEnabled() && (
        <p className="mb-3 -mt-1 text-xs text-gray-400">
          {t('staffDeal.dealNumbers.syncNote')}
        </p>
      )}
      <DealReferencesForm
        applicationId={app.id}
        financeItNumber={app.financeItNumber}
        hdReference={app.hdReference}
        financed={dealFinanced}
        hdRequired={hdReferenceRequired(app.programType)}
      />
      {dealFinanced && (
        <VerifyFinanceNumberButton
          applicationId={app.id}
          verified={!!app.financeNumberVerifiedAt}
          canVerify={!!app.financeItNumber}
          verifiedByName={app.financeNumberVerifiedBy?.name ?? null}
          verifiedAt={app.financeNumberVerifiedAt ? app.financeNumberVerifiedAt.toLocaleString('en-CA') : null}
        />
      )}
      {dealFinanced && financeitEmailConfigured() && (
        <div className="mt-3">
          <FinanceitPullButton applicationId={app.id} />
        </div>
      )}
    </div>
  );

  // Decision + status controls. Previously these lived in a separate right-hand
  // column; folding them into the top of "Review & decide" makes the whole step
  // read as one flow — make the call here (approve / decline / request docs),
  // change it later, or jump the status by hand.
  const decisionSection = (
    <div>
      {app.status === 'SUBMITTED' && (
        <form action={startReview} className="mb-4">
          <button type="submit" className="btn-secondary w-full sm:w-auto">{t('staffDeal.decision.startReview')}</button>
        </form>
      )}
      {options.some((o) => o.value === 'FUND') && !verificationComplete && (
        <p className="mb-4 rounded bg-amber-50 p-2 text-xs text-amber-800">
          {t('staffDeal.decision.verifyBeforeFund')}
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
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('staffDeal.decision.changeStatus')}</h4>
        <StatusChangeForm applicationId={app.id} current={app.status} />
        <p className="mt-2 text-xs text-gray-400">
          {t('staffDeal.decision.statusHint')}
        </p>
      </div>
    </div>
  );

  // Write-to-journal lives at the very top of "Review & decide" — it's the action
  // a reviewer reaches for most once a deal is decided, so it shouldn't be buried.
  const journalTopSection =
    journalEnabled() && decided ? (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <WriteToJournalButton
          applicationId={app.id}
          syncedAt={app.journalSyncedAt ? app.journalSyncedAt.toISOString() : null}
          tab={app.journalTab}
          row={app.journalRow}
        />
      </div>
    ) : null;

  // Edit button — anything the dealer submitted can be corrected here (e.g. a
  // deal that came in without a finance company). Opens the full edit form.
  const editButton = (
    <div className="flex justify-end">
      <Link href={`/staff/applications/${app.id}/edit`} className="btn-secondary text-sm">
        {t('staffDeal.editDealDetails')}
      </Link>
    </div>
  );

  const phaseBody: Record<string, ReactNode> = {
    // 1 · Review & decide. Order (per reviewer request): write-to-journal at the
    // top, then the customer information, an Edit button, the working numbers and
    // documents, and finally the Decision area — folded away at the bottom since
    // it's the least-touched part once a deal is moving.
    decide: (
      <div className="space-y-6">
        {journalTopSection}
        <CollapsibleEntry
          storageKey={`entryview:${app.id}`}
          snapshot={
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 [&>div]:min-w-0 [&_dd]:break-words">
              <div><dt className="text-gray-500">{t('staffDeal.snapshot.program')}</dt><dd><ProgramBadge type={app.programType} category={programCategoryLabel(t, app.programCategory)} /></dd></div>
              <div><dt className="text-gray-500">{t('staffDeal.snapshot.customer')}</dt><dd className="font-medium">{app.applicantFirstName} {app.applicantLastName}</dd></div>
              <div><dt className="text-gray-500">{t('staffDeal.snapshot.phone')}</dt><dd className="font-medium">{app.applicantPhone}</dd></div>
              <div className="sm:col-span-2"><dt className="text-gray-500">{t('staffDeal.snapshot.address')}</dt><dd className="font-medium">{fullAddress || '—'}{!revealOk && app.applicantAddressEnc && <a href={`/staff/applications/${app.id}?reveal=1`} className="ml-2 text-xs font-normal text-brand-600 hover:underline">{t('staffDeal.snapshot.revealStreet')}</a>}</dd></div>
              <div><dt className="text-gray-500">{t('staffDeal.snapshot.products')}</dt><dd className="font-medium">{app.productsSold.length ? app.productsSold.join(', ') : '—'}</dd></div>
              <div><dt className="text-gray-500">{t('staffDeal.snapshot.amount')}</dt><dd className="font-medium">{app.approvedAmount ? `$${app.approvedAmount.toString()}` : `$${app.requestedAmount.toString()}`}</dd></div>
              {app.isSplitPayment && <div><dt className="text-gray-500">{t('staffDeal.snapshot.financed')}</dt><dd className="font-medium text-brand-700">${financedAmt.toLocaleString('en-CA', { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-gray-400">{t('staffDeal.snapshot.split')}</span></dd></div>}
              <div><dt className="text-gray-500">{t('staffDeal.snapshot.payment')}</dt><dd className="font-medium">{app.paymentMethod ? paymentMethodLabel(t, app.paymentMethod) : t('staffDeal.snapshot.notSpecified')}</dd></div>
              <div><dt className="text-gray-500">{t('staffDeal.snapshot.financeCompany')}</dt><dd className="font-medium">{financeCompanyDisplay(app)}</dd></div>
              <div><dt className="text-gray-500">{t('staffDeal.snapshot.financingDeal')}</dt><dd className="font-medium">{app.financeItNumber ?? '—'}</dd></div>
              <div><dt className="text-gray-500">{t('staffDeal.snapshot.hdCustomer')}</dt><dd className="font-medium">{app.hdReference ?? '—'}</dd></div>
            </dl>
          }
        >
          <ReviewerEntryView
            app={app}
            loan={loan}
            reveal={revealOk}
            pv={pv}
            revealHref={`/staff/applications/${app.id}?reveal=1`}
            hideHref={`/staff/applications/${app.id}`}
            printHref={`/staff/applications/${app.id}/print`}
            t={t}
          />
        </CollapsibleEntry>
        {editButton}
        {paymentBreakdownSection}
        {dealNumbersSection}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">{t('staffDeal.applicationDocuments')}</h3>
          <DocumentList documents={applicationDocs} deleteAction={deleteDocumentAction} />
        </div>
        <CollapsibleSection title={t('staffDeal.decision.title')} defaultOpen={!decided} summary={<span>{t(`enum.status.${app.status}`)}</span>}>
          {decisionSection}
        </CollapsibleSection>
      </div>
    ),
    // 2 · Produce install documents
    produce: (
      <div>
        {/* Copy to Home Depot — shown for EVERY HD deal, including before the HD
            Customer # exists (that's exactly when you're creating the HD
            paperwork to GET the number), so it's never hidden behind the gate
            below. Open by default so it's impossible to miss. */}
        {app.programType === 'HD' && (
          <details open className="mb-4 overflow-hidden rounded-lg border-2 border-orange-300 bg-orange-50/40">
            <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-bold text-orange-900 hover:bg-orange-50">
              <span aria-hidden>📋</span> Copy to Home Depot — lead &amp; agreement fields
            </summary>
            <div className="border-t border-orange-200 bg-white px-4 py-4">
              {!revealOk && app.applicantAddressEnc && (
                <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-700">
                  The street address is hidden.{' '}
                  <a href={`/staff/applications/${app.id}?reveal=1`} className="font-medium text-brand-700 hover:underline">
                    Reveal street address →
                  </a>{' '}
                  (logged), then the address fields will fill in.
                </p>
              )}
              <p className="mb-3 rounded bg-sky-50 p-2 text-xs text-sky-800">
                ⚡ <strong>One-click autofill (beta):</strong>{' '}
                <a href="/hd-autofill.user.js" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">
                  install the HD autofill helper →
                </a>{' '}
                (needs the free <em>Tampermonkey</em> browser extension). Then on the HD form: Copy all here → paste into the helper → Fill. Plain fields fill automatically; dropdowns you still pick by hand.
              </p>
              <HdEntrySheet sections={hdSections} />
            </div>
          </details>
        )}
        {hdBlocksPaperwork ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-900">{t('staffDeal.produce.addHdFirst')}</p>
            <p className="mt-1 text-amber-800">
              {t('staffDeal.produce.addHdBefore')}{' '}
              <strong>{t('staffDeal.reviewDecide')} → {t('staffDeal.dealNumbers.title')}</strong> {t('staffDeal.produce.addHdAfter')}
            </p>
          </div>
        ) : (
          <>
            {app.programType === 'HD' && (
              <div className="mb-4">
                <h3 className="mb-1 text-sm font-medium text-gray-700">{t('staffDeal.produce.hdWaiverTitle')}</h3>
                <p className="mb-2 text-xs text-gray-500">{t('staffDeal.produce.hdWaiverNote')}</p>
                <HdWaiverCard
                  title={t('staffDeal.produce.hdWaiverTitle')}
                  hint={t('staffDeal.produce.hdWaiverHint')}
                  applicationId={app.id}
                />
              </div>
            )}
            <p className="mb-4 text-xs text-gray-500">{t('staffDeal.produce.uploadHint')}</p>
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
    // 3 · Sent — awaiting install. This step is about WAITING on the dealer, not a
    // second copy of "Produce install documents" — so the focus is the
    // Mark-complete button, the waiting note, and what's already been sent. The
    // reviewer can still send more paperwork, but the full uploader is tucked
    // behind a "Send more paperwork" disclosure so it doesn't read as a duplicate
    // of step 2. (Native <details> — no JS needed, collapsed by default.)
    await: (
      <div>
        <ReviewerDoneButton
          applicationId={app.id}
          doneAt={app.reviewerDoneAt ? app.reviewerDoneAt.toISOString() : null}
          doneByName={app.reviewerDoneByName}
        />
        <p className="mb-4 text-xs text-gray-500">
          {t('staffDeal.await.waiting')}
        </p>
        <div className="mb-2 text-sm font-medium text-gray-700">{t('staffDeal.await.sentDocs')}</div>
        <div className="mb-4">
          <DocumentList documents={reviewerDocs} deleteAction={deleteDocumentAction} />
        </div>
        <details className="border-t border-gray-100 pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-base leading-none">＋</span>
            {t('staffDeal.await.sendMore')}
          </summary>
          <p className="mt-1 text-xs text-gray-500">{t('staffDeal.await.sendMoreHint')}</p>
          <div className="mt-4">
            <ReviewerPaperworkBoxes
              action={uploadReviewerPaperworkAction.bind(null, app.id)}
              categories={REVIEWER_PAPERWORK_TYPES}
              scope={app.id}
            />
          </div>
        </details>
      </div>
    ),
    // 4 · Review signed documents
    review: (
      <div className="space-y-6">
        {returnedApplicationDocs.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <h3 className="mb-1 text-sm font-medium text-amber-900">{t('staffDeal.review.returnedTitle')}</h3>
            <p className="mb-2 text-xs text-amber-700">
              {t('staffDeal.review.returnedNote')}
            </p>
            <DocumentList documents={returnedApplicationDocs} deleteAction={deleteDocumentAction} />
          </div>
        )}
        {app.serialNumbers.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-medium text-gray-700">{t('staffDeal.review.serialNumbers')}</h3>
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
          <h3 className="mb-1 text-sm font-medium text-gray-700">{t('staffDeal.review.fundingVerification')}</h3>
          <p className="mb-3 text-xs text-gray-500">
            {t('staffDeal.review.fundingVerificationHint')}
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
          <h3 className="text-sm font-medium text-gray-700">{t('staffDeal.confirm.title')}</h3>
          <ConfirmationBadge status={app.confirmationStatus} />
        </div>
        <p className="mb-4 text-xs text-gray-500">{t('staffDeal.confirm.scriptHint')}</p>
        <CallAttemptLog
          applicationId={app.id}
          attempts={app.confirmationAttempts.map((a) => ({
            id: a.id,
            outcome: a.outcome,
            at: a.createdAt.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
            by: a.createdBy?.name ?? null,
          }))}
        />
        <ConfirmationForm
          applicationId={app.id}
          data={app.confirmation}
          applicantName={`${app.applicantFirstName} ${app.applicantLastName}`}
          defaultProduct={app.productsSold.length ? app.productsSold.join(', ') : PROGRAM_CATEGORY_LABELS[app.programCategory]}
          defaultCity={app.loanApplication?.city ?? ''}
          defaultPhone={app.applicantPhone}
          defaultAmount={(app.approvedAmount ?? app.requestedAmount).toString()}
        />
        <CallRecordingPanel enabled={voiceEnabled()} />
        <ReviewRequestCard
          applicationId={app.id}
          customerEmail={app.applicantEmail ?? ''}
          customerPhone={app.applicantPhone}
          reviewLinkSet={!!reviewLink}
          smsConfigured={smsEnabled()}
          canManageLink={user.role === 'ADMIN'}
          sentAt={app.reviewRequestSentAt ? app.reviewRequestSentAt.toISOString() : null}
          sentVia={app.reviewRequestVia}
          sentByName={app.reviewRequestByName}
        />
        <FlagDealerIssueCard applicationId={app.id} />
        <EmailDocsCard applicationId={app.id} customerEmail={app.applicantEmail ?? ''} docs={libraryDocs} />
      </div>
    ),
    // 6 · Submit to finance company
    submit: (
      <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
        {t('staffDeal.submit.before')} <strong>{t('staffDeal.reviewDecide')}</strong>. {t('staffDeal.submit.after')}
      </p>
    ),
    // 7 · Awaiting funding — the Mark Funded button, but only once the deal has
    // actually reached "in for funding" (not on an earlier phase).
    // Shown once the deal reaches funding and until it's paid: "Mark Funded"
    // (only when not already Funded) and "Check journal now" — which reads the
    // live journal and flips the deal to Paid when it shows OK + a Date Paid.
    funding: ['FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'].includes(app.status)
      ? <FundingStepActions applicationId={app.id} journalCheckedAt={app.journalCheckedAt ? app.journalCheckedAt.toISOString() : null} canMarkFunded={app.status !== 'FUNDED'} />
      : null,
    // 8 · Pay dealer. Once a payout has been recorded — which now happens
    // automatically from the sales journal ("Pay to dealer") — there's nothing for
    // the reviewer to fill in: show it as complete and tuck the manual entry away
    // behind a collapsed section for the rare correction/second payout.
    pay: (
      <div>
        {app.payouts.length > 0 ? (
          <>
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <span className="font-semibold">{t('staffDeal.pay.paidNothing')}</span>{' '}
              {app.journalPaidOn
                ? <>{t('staffDeal.pay.journalMarkedBefore')} <strong>{t('staffDeal.pay.okPaid')}</strong> {t('staffDeal.pay.journalMarkedAfter', { date: app.journalPaidOn.toLocaleDateString('en-CA') })}</>
                : <>{t('staffDeal.pay.payoutRecorded')}</>}
            </div>
            <div className="mb-5">
              <PayoutReceipt payouts={app.payouts} />
            </div>
            <CollapsibleSection title={t('staffDeal.pay.recordAnother')} defaultOpen={false}>
              <PayoutForm applicationId={app.id} />
            </CollapsibleSection>
          </>
        ) : (
          <>
            {app.journalPaidOn && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <span className="font-semibold">{t('staffDeal.pay.salesJournalLabel')}</span> {t('staffDeal.pay.markedBefore')} <strong>{t('staffDeal.pay.okPaid')}</strong>{' '}
                {t('staffDeal.pay.markedAfter', { date: app.journalPaidOn.toLocaleDateString('en-CA') })}
              </div>
            )}
            <div className="border-t border-gray-100 pt-4">
              <h3 className="mb-3 text-sm font-medium text-gray-700">{t('staffDeal.pay.recordPayout')}</h3>
              <PayoutForm applicationId={app.id} />
            </div>
          </>
        )}
      </div>
    ),
  };

  const phaseSummary: Record<string, string> = {
    decide: t('staffDeal.phaseSummary.decide'),
    produce: reviewerDocs.length === 1
      ? t('staffDeal.phaseSummary.produceDocOne')
      : t('staffDeal.phaseSummary.produceDocs', { n: reviewerDocs.length }),
    await: t('staffDeal.phaseSummary.await'),
    review: t('staffDeal.phaseSummary.review'),
    confirm: t('staffDeal.phaseSummary.confirm'),
    submit: t('staffDeal.phaseSummary.submit'),
    funding: t('staffDeal.phaseSummary.funding'),
    pay: t('staffDeal.phaseSummary.pay'),
  };

  const phaseAuto: Record<string, string> = {
    decide: t('staffDeal.phaseAuto.decide'),
    produce: t('staffDeal.phaseAuto.produce'),
    review: t('staffDeal.phaseAuto.review'),
    submit: t('staffDeal.phaseAuto.submit'),
    pay: t('staffDeal.phaseAuto.pay'),
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
  const refsList = missingRefs.length === 2 ? `${missingRefs[0]} ${t('staffDeal.and')} ${missingRefs[1]}` : missingRefs[0];
  const reviewAlert = decideNeedsRefs
    ? { message: t('staffDeal.reviewAlert', { refs: refsList }) }
    : null;

  // While an approved deal is still missing a required number (the HD Customer #),
  // keep the Deal numbers card pinned beneath the collapsed "Review & decide" step
  // so it can be finished without expanding the whole step. It disappears — and
  // the step collapses fully — the moment the number is saved.
  const decidePinned = decideNeedsRefs ? (
    <div className="space-y-2">
      <p className="text-xs font-medium text-amber-700">
        {t('staffDeal.decidePinned')}
      </p>
      {dealNumbersSection}
    </div>
  ) : undefined;

  const phases = reviewerPhaseStates(flowSignals).map((p) => {
    const state = p.id === 'confirm' ? confirmState : p.state;
    return {
      ...p,
      state,
      body: phaseBody[p.id],
      summary: phaseSummary[p.id],
      autoNote: state === 'done' ? undefined : phaseAuto[p.id],
      attention: p.id === 'decide' ? decideNeedsRefs : undefined,
      pinned: p.id === 'decide' ? decidePinned : undefined,
    };
  });

  // Notes + history — always available, not tied to a phase.
  const comms = (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{t('staffDeal.comms.chatTitle')}</h3>
        <p className="mb-3 text-xs text-gray-500">{t('staffDeal.comms.chatHint')}</p>
        <ConversationThread applicationId={app.id} placeholder={t('staffDeal.comms.chatPlaceholder')} />
      </div>
      <div className="border-t border-gray-100 pt-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('staffDeal.comms.history')}</h3>
        <ul className="space-y-2 text-sm">
          {app.statusEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between">
              <span>
                {e.from ? `${t(`enum.status.${e.from}`)} → ` : ''}
                <span className="font-medium">{t(`enum.status.${e.to}`)}</span>
                {e.note && <span className="ml-2 text-gray-500">— {e.note}</span>}
                <span className="ml-2 text-xs text-gray-400">{t('staffDeal.comms.by', { name: e.actor.name })}</span>
              </span>
              <span className="text-xs text-gray-400">{e.createdAt.toLocaleString('en-CA')}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">{t('staffDeal.comms.activityLog')}</h3>
        <p className="mb-3 text-xs text-gray-500">{t('staffDeal.comms.activityHint')}</p>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-500">{t('staffDeal.comms.noActivity')}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2 last:border-0">
                <span>
                  <span className="font-medium text-gray-800">{e.actor?.name ?? e.actorName ?? t('staffDeal.comms.system')}</span>
                  <span className="text-gray-600"> — {actionLabel(t, e.action)}</span>
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
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('staffDeal.comms.decisionLog')}</h3>
          <ul className="space-y-2 text-sm">
            {app.decisions.map((d) => {
              const tone = decisionTone(d.type);
              return (
                <li key={d.id} className={`rounded border p-2 ${tone.card}`}>
                  <span className={`font-semibold ${tone.label}`}>{decisionDisplayLabel(t, d.type)}</span>
                  {d.notes && <p className="text-gray-700">{d.notes}</p>}
                  <p className="text-xs text-gray-500">{d.decidedBy.name} · {d.createdAt.toLocaleString('en-CA')}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {app.consents.length > 0 && (
        <div className="border-t border-gray-100 pt-4 text-xs text-gray-500">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">{t('staffDeal.comms.consent')}</h3>
          <p>{t('staffDeal.comms.captured', { date: app.consents[0].capturedAt.toLocaleString('en-CA') })}</p>
          <p>{t('staffDeal.comms.policyVersion', { version: app.consents[0].policyVersion })}</p>
          {app.consents[0].ipAddress && <p>{t('staffDeal.comms.ip', { ip: app.consents[0].ipAddress })}</p>}
        </div>
      )}
    </div>
  );

  const cx = app.cancellations[0] ?? null;
  const cancellationVM: CancellationReviewVM | null = cx && cx.status !== 'REVERSED'
    ? {
        id: cx.id,
        status: cx.status as 'PENDING' | 'CONFIRMED' | 'REJECTED',
        reason: cx.reason,
        requestedBy: cx.requestedBy?.name ?? t('staffDeal.cancellation.dealer'),
        requestedAt: cx.createdAt.toLocaleString('en-CA'),
        wasFunded: cx.wasFunded,
        uninstallDate: cx.uninstallDate ? cx.uninstallDate.toLocaleDateString('en-CA') : null,
        hdRefundConfirmed: cx.hdRefundConfirmed,
        handledAt: cx.handledAt ? cx.handledAt.toLocaleString('en-CA') : null,
        handledBy: cx.handledBy?.name ?? null,
        reviewerNote: cx.reviewerNote,
      }
    : null;

  // Internal notes, pinned to the top of the profile so every reviewer sees the
  // latest staff note the moment they open the file (newest first). Adding a note
  // revalidates the page, so a new note surfaces here for other reviewers on their
  // next load/refresh.
  const internalNotesPanel = (
    <section className="card border border-amber-300 bg-amber-50/40 p-4">
      <h2 className="text-sm font-semibold text-gray-900">{t('staffDeal.comms.internalTitle')}</h2>
      <p className="mb-3 text-xs text-amber-700">{t('staffDeal.comms.internalHint')}</p>
      <NoteForm
        action={addStaffNoteAction}
        hidden={{ applicationId: app.id, internal: 'true' }}
        placeholder={t('staffDeal.comms.internalPlaceholder')}
        label={t('staffDeal.comms.addInternalNote')}
        templates={noteTemplates}
      />
      <div className="mt-4">
        <NoteThread notes={internalNotes} emptyText={t('staffDeal.comms.noInternalNotes')} />
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/staff" className="text-sm text-gray-500 hover:underline">{t('staffDeal.backToQueue')}</Link>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-gray-900">
              <ProgramBadge type={app.programType} category={programCategoryLabel(t, app.programCategory)} size="lg" />
              {app.applicantFirstName} {app.applicantLastName}
            </h1>
            <StatusBadge status={app.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-500">
              {app.dealer.name} · {t('staffDeal.submittedBy', { name: app.createdBy.name })} · {app.createdAt.toLocaleString('en-CA')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/staff/applications/${app.id}/edit`} className="btn-secondary text-xs">
                ✎ {t('staffDeal.editDeal')}
              </Link>
              {app.documents.some((d) => d.stage === 'FUNDING' || d.stage === 'REVIEWER') && (
                // The docs that get uploaded to the funder / Home Depot, cleanly
                // named, as one ZIP. Blob download so it works in the installed PWA.
                <DownloadButton
                  url={`/api/applications/${app.id}/upload-package`}
                  fileName={`GWA_${app.applicantLastName}_${app.applicantFirstName}_upload-package.zip`}
                  className="btn-secondary text-xs"
                  title={t('staffDeal.downloadPackageTitle')}
                >
                  ↓ {t('staffDeal.downloadUploadPackage')}
                </DownloadButton>
              )}
              {app.documents.length > 0 && (
                // Blob download (not a plain <a href>) so it also works in the
                // installed PWA, where navigating the window to the ZIP would
                // dead-end the reviewer on the file with no back button.
                <DownloadButton
                  url={`/api/applications/${app.id}/documents`}
                  fileName={`GWA_${app.applicantLastName}_${app.applicantFirstName}_documents.zip`}
                  className="btn-secondary text-xs"
                >
                  ↓ {t('staffDeal.downloadAllDocuments')}
                </DownloadButton>
              )}
            </div>
          </div>
        </div>

        {/* Internal staff notes — pinned to the top so reviewers see them first. */}
        {internalNotesPanel}

        {/* Dealer-requested cancellation — reviewer confirms (or rejects) it. */}
        {cancellationVM && <CancellationReviewCard c={cancellationVM} />}

        {/* Cancelled deal — reviewer can reactivate it (turn it back to active). */}
        {app.status === 'WITHDRAWN' && <ReactivateDealCard applicationId={app.id} />}

        {/* Progress tracker */}
        <DealProgress
          variant="timeline"
          status={app.status}
          approvedById={app.approvedById}
          confirmationStatus={app.confirmationStatus}
          hasFundingDocs={app.documents.some((d) => d.stage === 'FUNDING')}
          hasPayouts={app.payouts.length > 0}
          journalPaidOn={app.journalPaidOn}
          stageDates={stageDates}
        />

        {/* Booking activity streamed back from the booking app (appointments,
            installs, service) — renders only when there's activity. */}
        <BookingActivityCard applicationId={app.id} phone={app.applicantPhone} />

        {confirmationIssue && <ConfirmationIssueBanner side="staff" issue={confirmationIssue} />}

        {app.taxExempt && (() => {
          const ex = exemptionSummary({ taxExempt: true, province: app.province, deliveredToReserve: app.deliveredToReserve });
          const statusCard = revealOk ? (decryptOptional(app.statusCardNumberEnc) ?? '—') : masked(app.statusCardNumberEnc);
          return (
            <section className="card border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge bg-amber-200 text-amber-900">🪶 {t('staffDeal.taxExempt.badge')} · {ex.label}</span>
                <span className="text-sm text-amber-900">{ex.detail}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 [&>div]:min-w-0 [&_dd]:break-words">
                <div><dt className="text-gray-500">{t('staffDeal.taxExempt.statusCard')}</dt><dd className="font-medium">{statusCard}{!revealOk && app.statusCardNumberEnc && <a href={`/staff/applications/${app.id}?reveal=1`} className="ml-2 text-xs text-brand-600 hover:underline">{t('staffDeal.taxExempt.reveal')}</a>}</dd></div>
                <div><dt className="text-gray-500">{t('staffDeal.taxExempt.band')}</dt><dd className="font-medium">{app.bandName ?? '—'}</dd></div>
                <div><dt className="text-gray-500">{t('staffDeal.taxExempt.onReserve')}</dt><dd className="font-medium">{app.deliveredToReserve ? t('common.yes') : t('common.no')}</dd></div>
                <div><dt className="text-gray-500">{t('staffDeal.taxExempt.province')}</dt><dd className="font-medium">{app.province}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-amber-800">{t('staffDeal.taxExempt.verifyNote')}</p>
            </section>
          );
        })()}

      {partialFunding && (
        <section className="card border-2 border-amber-400 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            💵 {t('staffDeal.partialFunding.title')}
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            {t('staffDeal.partialFunding.seg1')} <strong>{t('staffDeal.partialFunding.splitPayment')}</strong> {t('staffDeal.partialFunding.seg2')}{' '}
            <strong>${partialFunding.received.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</strong> {t('staffDeal.partialFunding.seg3')}{' '}
            <strong>~${partialFunding.expected.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</strong>{t('staffDeal.partialFunding.seg4')}{' '}
            <strong>{t('staffDeal.partialFunding.funded')}</strong> {t('staffDeal.partialFunding.seg5')}
          </p>
        </section>
      )}

      {lateDealerDocs.length > 0 && (
        <section className="card border-2 border-amber-400 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            📎 {lateDealerDocs.length === 1 ? t('staffDeal.lateDocs.titleOne') : t('staffDeal.lateDocs.titleMany', { n: lateDealerDocs.length })}
          </h2>
          <p className="mb-3 mt-1 text-xs text-amber-800">
            {lateDealerDocs.length === 1 ? t('staffDeal.lateDocs.uploadedOneBefore') : t('staffDeal.lateDocs.uploadedManyBefore')}{' '}
            <strong>{t(`enum.status.${app.status}`)}</strong>{lateDealerDocs.length === 1 ? t('staffDeal.lateDocs.uploadedOneAfter') : t('staffDeal.lateDocs.uploadedManyAfter')}
          </p>
          <DocumentList documents={lateDealerDocs} deleteAction={deleteDocumentAction} />
        </section>
      )}

      {fundingSubmitDiagnosis.show && !packageReturnedEarly && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white" aria-hidden>i</span>
          <div className="text-sm text-amber-900">
            <p className="font-semibold">{fundingSubmitDiagnosis.title}</p>
            <p className="mt-0.5">{fundingSubmitDiagnosis.detail}</p>
            {fundingSubmitDiagnosis.missingSerialProducts.length === 0 && (
              <div className="mt-2"><AdvanceToFundingButton applicationId={app.id} ready={fundingDocsReady} /></div>
            )}
          </div>
        </div>
      )}

      {packageReturnedEarly && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white" aria-hidden>!</span>
          <div className="text-sm text-red-900">
            <p className="font-semibold">{t('staffDeal.outOfBand.title')}</p>
            <p className="mt-0.5">
              {t('staffDeal.outOfBand.before')}{' '}
              <strong>{t('staffDeal.fundingDocuments')}</strong>{t('staffDeal.outOfBand.after')}
            </p>
            <AdvanceToFundingButton applicationId={app.id} ready={fundingDocsReady} />
          </div>
        </div>
      )}

      <ReviewerWorkspace
        phases={phases}
        comms={comms}
        dealerStatus={dealerStatus}
        alert={reviewAlert}
      />
    </div>
  );
}
