import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { decryptOptional, maskTail } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentList } from '@/components/DocumentList';
import { LoanApplicationDetails } from '@/components/LoanApplicationDetails';
import { PayoutReceipt } from '@/components/PayoutReceipt';
import { UploadForm } from '@/components/UploadForm';
import { DecisionForm } from './DecisionForm';
import { PayoutForm } from './PayoutForm';
import {
  startReviewAction,
  startFundingReviewAction,
  uploadReviewerPaperworkAction,
} from '@/app/(staff)/actions';
import { STATUS_LABELS, programLabel } from '@/lib/constants';
import type { ApplicationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

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
      payouts: { orderBy: { paidOn: 'desc' }, include: { createdBy: true } },
    },
  });
  if (!app) notFound();

  const reveal = searchParams.reveal === '1';

  // Only the government ID, date of birth, and address are protected identity
  // fields (SIN and banking are not collected). Decrypt only when revealed.
  let govId = maskTail(decryptOptional(app.govIdNumberEnc), 3);
  let dob = '••••';
  let address = '••••';

  if (reveal) {
    govId = decryptOptional(app.govIdNumberEnc) ?? '—';
    dob = decryptOptional(app.applicantDobEnc) ?? '—';
    address = decryptOptional(app.applicantAddressEnc) ?? '—';
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
  const startFundingReview = startFundingReviewAction.bind(null, app.id);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <Link href="/staff" className="text-sm text-gray-500 hover:underline">← Back to queue</Link>
          <div className="mt-2 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">
              {app.applicantFirstName} {app.applicantLastName}
            </h1>
            <StatusBadge status={app.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {app.dealer.name} · submitted by {app.createdBy.name} · {app.createdAt.toLocaleString('en-CA')}
          </p>
        </div>

        {/* Summary */}
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Summary</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-gray-500">Province</dt><dd className="font-medium">{app.province}</dd></div>
            <div><dt className="text-gray-500">Program</dt><dd className="font-medium">{programLabel(app.programType, app.programCategory)}</dd></div>
            <div><dt className="text-gray-500">Entry method</dt><dd className="font-medium">{app.entryMethod === 'TYPED' ? 'Typed in' : app.entryMethod === 'PHOTO' ? 'Photo upload' : 'FinanceIt #'}</dd></div>
            <div><dt className="text-gray-500">Requested</dt><dd className="font-medium">${app.requestedAmount.toString()}</dd></div>
            <div><dt className="text-gray-500">Date of sale</dt><dd className="font-medium">{app.dateOfSale ? app.dateOfSale.toLocaleDateString('en-CA') : '—'}</dd></div>
            <div><dt className="text-gray-500">Installation date</dt><dd className="font-medium">{app.installationDate ? app.installationDate.toLocaleDateString('en-CA') : '—'}</dd></div>
            <div><dt className="text-gray-500">HD store</dt><dd className="font-medium">{app.homeDepotStore ? app.homeDepotStore.number : '—'}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{app.applicantEmail}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{app.applicantPhone}</dd></div>
            <div><dt className="text-gray-500">Income</dt><dd className="font-medium">{app.incomeAnnual ? `$${app.incomeAnnual.toString()}` : '—'}</dd></div>
            <div><dt className="text-gray-500">FinanceIt #</dt><dd className="font-medium">{app.financeItNumber ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Loan ref</dt><dd className="font-medium">{app.loanReference ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Employer</dt><dd className="font-medium">{app.employer ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Co-applicant</dt><dd className="font-medium">{app.coApplicantName ?? '—'}</dd></div>
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
            <div><dt className="text-gray-500">Gov ID #</dt><dd className="font-mono font-medium">{govId}</dd></div>
            <div><dt className="text-gray-500">Date of birth</dt><dd className="font-medium">{dob}</dd></div>
            <div><dt className="text-gray-500">Address</dt><dd className="font-medium">{address}</dd></div>
          </dl>
        </section>

        {app.loanApplication && <LoanApplicationDetails loan={app.loanApplication} />}

        {/* Documents */}
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Application documents</h2>
          <DocumentList documents={applicationDocs} />
        </section>

        {(fundingDocs.length > 0 || app.serialNumbers.length > 0) && (
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
            <DocumentList documents={fundingDocs} />
          </section>
        )}

        {/* Paperwork for the dealer (HD / Financing) */}
        <section className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Paperwork for dealer</h2>
          <p className="mb-4 text-xs text-gray-500">Upload paperwork the dealer can view and download. Files are converted to PDF.</p>
          <div className="mb-4">
            <DocumentList documents={reviewerDocs} />
          </div>
          <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">HD paperwork</div>
              <UploadForm action={uploadReviewerPaperworkAction.bind(null, app.id, 'HD_PAPERWORK')} label="Upload HD" />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Financing paperwork</div>
              <UploadForm action={uploadReviewerPaperworkAction.bind(null, app.id, 'FINANCING_PAPERWORK')} label="Upload financing" />
            </div>
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
      </div>

      {/* Decision sidebar */}
      <div className="space-y-6">
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Decision</h2>
          {app.status === 'SUBMITTED' && (
            <form action={startReview} className="mb-4">
              <button type="submit" className="btn-secondary w-full">Start review</button>
            </form>
          )}
          {app.status === 'FUNDING_SUBMITTED' && (
            <form action={startFundingReview} className="mb-4">
              <button type="submit" className="btn-secondary w-full">Start funding review</button>
            </form>
          )}
          <DecisionForm applicationId={app.id} options={options} />
        </section>

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
  );
}
