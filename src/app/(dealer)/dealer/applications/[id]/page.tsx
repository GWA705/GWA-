import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { canAccessApplication } from '@/lib/rbac';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentList } from '@/components/DocumentList';
import { LoanApplicationDetails } from '@/components/LoanApplicationDetails';
import { UploadForm } from '@/components/UploadForm';
import { SerialNumberForm } from '@/components/SerialNumberForm';
import { FUNDING_DOCUMENT_TYPES, STATUS_LABELS, programLabel } from '@/lib/constants';
import {
  uploadSupportingDocAction,
  uploadFundingDocAction,
  addSerialNumberAction,
  submitFundingAction,
} from '@/app/(dealer)/actions';

export const dynamic = 'force-dynamic';

export default async function DealerApplicationDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { missing?: string };
}) {
  const user = await requireRole('DEALER_USER');
  const app = await prisma.application.findUnique({
    where: { id: params.id },
    include: {
      documents: { orderBy: { createdAt: 'desc' } },
      serialNumbers: { orderBy: { createdAt: 'asc' } },
      statusEvents: { orderBy: { createdAt: 'desc' }, include: { actor: true } },
      decisions: { orderBy: { createdAt: 'desc' }, include: { decidedBy: true } },
      homeDepotStore: true,
      loanApplication: true,
    },
  });
  if (!app || !canAccessApplication(user, app.dealerId)) notFound();

  const applicationDocs = app.documents.filter((d) => d.stage === 'APPLICATION');
  const fundingDocs = app.documents.filter((d) => d.stage === 'FUNDING');
  const uploadedFundingTypes = new Set(fundingDocs.map((d) => d.type));

  const fundingStageOpen = ['APPROVED', 'CONDITIONAL'].includes(app.status);
  const inFundingReview = ['FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'].includes(app.status);

  const requiredFunding = FUNDING_DOCUMENT_TYPES.filter(
    (t) => !t.homeownershipOnly || app.homeownershipRequired,
  );
  const missingCount = requiredFunding.filter(
    (t) => t.required && !uploadedFundingTypes.has(t.type),
  ).length;

  const submitFunding = submitFundingAction.bind(null, app.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dealer" className="text-sm text-gray-500 hover:underline">
          ← Back to applications
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            {app.applicantFirstName} {app.applicantLastName}
          </h1>
          <StatusBadge status={app.status} />
        </div>
      </div>

      {searchParams.missing && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          You still have {searchParams.missing} required funding document(s) to upload before you
          can submit the funding package.
        </div>
      )}

      {/* Summary */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Application summary</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-gray-500">Province</dt><dd className="font-medium">{app.province}</dd></div>
          <div><dt className="text-gray-500">Program</dt><dd className="font-medium">{programLabel(app.programType, app.programCategory)}</dd></div>
          <div><dt className="text-gray-500">Requested</dt><dd className="font-medium">${app.requestedAmount.toString()}</dd></div>
          <div><dt className="text-gray-500">Date of sale</dt><dd className="font-medium">{app.dateOfSale ? app.dateOfSale.toLocaleDateString('en-CA') : '—'}</dd></div>
          <div><dt className="text-gray-500">Installation date</dt><dd className="font-medium">{app.installationDate ? app.installationDate.toLocaleDateString('en-CA') : '—'}</dd></div>
          <div><dt className="text-gray-500">HD store</dt><dd className="font-medium">{app.homeDepotStore ? app.homeDepotStore.number : '—'}</dd></div>
          <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{app.applicantEmail}</dd></div>
          <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{app.applicantPhone}</dd></div>
          <div><dt className="text-gray-500">FinanceIt #</dt><dd className="font-medium">{app.financeItNumber ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Homeownership required</dt><dd className="font-medium">{app.homeownershipRequired ? 'Yes' : 'No'}</dd></div>
        </dl>
        {app.financingNote && (
          <p className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-600"><span className="font-medium text-gray-700">Financing note: </span>{app.financingNote}</p>
        )}
        <p className="mt-4 text-xs text-gray-400">
          Sensitive fields (SIN, banking, ID) are stored encrypted and are only visible to the
          GWA review team through an audited path.
        </p>
      </section>

      {/* Decisions / reviewer notes */}
      {app.decisions.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Review decisions</h2>
          <ul className="space-y-2 text-sm">
            {app.decisions.map((d) => (
              <li key={d.id} className="rounded border border-gray-100 bg-gray-50 p-3">
                <span className="font-medium">{d.type.replace('_', ' ')}</span>
                {d.notes && <p className="mt-1 text-gray-600">{d.notes}</p>}
                <p className="mt-1 text-xs text-gray-400">
                  {d.decidedBy.name} · {d.createdAt.toLocaleString('en-CA')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {app.loanApplication && <LoanApplicationDetails loan={app.loanApplication} />}

      {/* Documents for approval */}
      <section className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Documents for approval</h2>
        <DocumentList documents={applicationDocs} />
        <div className="mt-4 border-t border-gray-100 pt-4">
          <UploadForm action={uploadSupportingDocAction.bind(null, app.id)} label="Upload document" />
        </div>
      </section>

      {/* Funding stage */}
      {(fundingStageOpen || inFundingReview) && (
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Funding package</h2>
            {inFundingReview && (
              <span className="text-xs text-gray-500">Status: {STATUS_LABELS[app.status]}</span>
            )}
          </div>

          {/* Serial numbers */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Serial number(s)</h3>
            {app.serialNumbers.length > 0 ? (
              <ul className="mb-3 space-y-1 text-sm">
                {app.serialNumbers.map((s) => (
                  <li key={s.id} className="text-gray-700">
                    <span className="font-mono">{s.value}</span>
                    {s.productLabel && <span className="ml-2 text-gray-400">({s.productLabel})</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-gray-500">No serial numbers added yet.</p>
            )}
            {fundingStageOpen && <SerialNumberForm action={addSerialNumberAction.bind(null, app.id)} />}
          </div>

          {/* Funding document checklist */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Required documents</h3>
            {requiredFunding.map((t) => {
              const uploaded = fundingDocs.filter((d) => d.type === t.type);
              const done = uploaded.length > 0;
              return (
                <div key={t.type} className="rounded border border-gray-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">
                      {done ? '✓ ' : '○ '}
                      {t.label}
                    </span>
                    {done && <span className="badge bg-green-100 text-green-800">Uploaded</span>}
                  </div>
                  {uploaded.length > 0 && (
                    <ul className="mt-2 text-xs text-gray-500">
                      {uploaded.map((u) => (
                        <li key={u.id}>
                          <a href={`/api/documents/${u.id}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                            {u.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {fundingStageOpen && (
                    <div className="mt-2">
                      <UploadForm action={uploadFundingDocAction.bind(null, app.id, t.type)} label="Upload" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {fundingStageOpen && (
            <form action={submitFunding} className="mt-6 flex items-center justify-end gap-3">
              {missingCount > 0 && (
                <span className="text-xs text-amber-700">{missingCount} required document(s) remaining</span>
              )}
              <button type="submit" className="btn-primary" disabled={missingCount > 0}>
                Submit funding package
              </button>
            </form>
          )}
        </section>
      )}

      {/* Status history */}
      <section className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">History</h2>
        <ul className="space-y-2 text-sm">
          {app.statusEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between">
              <span>
                {e.from ? `${STATUS_LABELS[e.from]} → ` : ''}
                <span className="font-medium">{STATUS_LABELS[e.to]}</span>
                {e.note && <span className="ml-2 text-gray-500">— {e.note}</span>}
              </span>
              <span className="text-xs text-gray-400">{e.createdAt.toLocaleString('en-CA')}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
