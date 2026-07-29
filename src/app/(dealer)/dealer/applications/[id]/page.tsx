import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { canAccessApplication } from '@/lib/rbac';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentList } from '@/components/DocumentList';
import { LoanApplicationDetails } from '@/components/LoanApplicationDetails';
import { PayoutReceipt } from '@/components/PayoutReceipt';
import { NoteThread } from '@/components/NoteThread';
import { NoteForm } from '@/components/NoteForm';
import { UploadForm } from '@/components/UploadForm';
import { SerialNumberForm } from '@/components/SerialNumberForm';
import { FUNDING_DOCUMENT_TYPES, STATUS_LABELS, programLabel } from '@/lib/constants';
import {
  uploadSupportingDocAction,
  uploadFundingDocAction,
  addSerialNumberAction,
  submitFundingAction,
  addDealerNoteAction,
} from '@/app/(dealer)/actions';

export const dynamic = 'force-dynamic';

export default async function DealerApplicationDetail({
  params,
}: {
  params: { id: string };
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
      financeCompany: true,
      payouts: { orderBy: { paidOn: 'desc' } },
      dealNotes: { where: { internal: false }, orderBy: { createdAt: 'asc' }, include: { author: true } },
    },
  });
  if (!app || !canAccessApplication(user, app.dealerId)) notFound();

  const applicationDocs = app.documents.filter((d) => d.stage === 'APPLICATION');
  const fundingDocs = app.documents.filter((d) => d.stage === 'FUNDING');
  const gwaDocs = app.documents.filter((d) => d.stage === 'REVIEWER');
  const uploadedFundingTypes = new Set(fundingDocs.map((d) => d.type));

  const fundingStageOpen = ['APPROVED', 'CONDITIONAL'].includes(app.status);
  const inFundingReview = ['FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'].includes(app.status);

  const requiredFunding = FUNDING_DOCUMENT_TYPES;
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

      {/* Summary */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Application summary</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-gray-500">Province</dt><dd className="font-medium">{app.province}</dd></div>
          <div><dt className="text-gray-500">Program</dt><dd className="font-medium">{programLabel(app.programType, app.programCategory)}</dd></div>
          <div><dt className="text-gray-500">Requested</dt><dd className="font-medium">${app.requestedAmount.toString()}</dd></div>
          <div><dt className="text-gray-500">Approved amount</dt><dd className="font-medium">{app.approvedAmount ? `$${app.approvedAmount.toString()}` : '—'}</dd></div>
          <div><dt className="text-gray-500">Finance company</dt><dd className="font-medium">{app.financeCompany?.name ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Date of sale</dt><dd className="font-medium">{app.dateOfSale ? app.dateOfSale.toLocaleDateString('en-CA') : '—'}</dd></div>
          <div><dt className="text-gray-500">Installation date</dt><dd className="font-medium">{app.installationDate ? app.installationDate.toLocaleDateString('en-CA') : '—'}</dd></div>
          <div><dt className="text-gray-500">HD store</dt><dd className="font-medium">{app.homeDepotStore ? app.homeDepotStore.number : '—'}</dd></div>
          <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{app.applicantEmail}</dd></div>
          <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{app.applicantPhone}</dd></div>
          <div><dt className="text-gray-500">FinanceIt deal #</dt><dd className="font-medium">{app.financeItNumber ?? '—'}</dd></div>
          <div><dt className="text-gray-500">HD Customer #</dt><dd className="font-medium">{app.hdReference ?? '—'}</dd></div>
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

      {/* Notes with GWA */}
      <section className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Notes</h2>
        <div className="mb-4">
          <NoteThread notes={app.dealNotes} emptyText="No messages yet. Use this to communicate with the GWA team about this deal." />
        </div>
        <NoteForm
          action={addDealerNoteAction.bind(null, app.id)}
          placeholder="Write a note to the GWA team…"
          label="Send"
        />
      </section>

      {/* Documents for approval */}
      <section className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Documents for approval</h2>
        <DocumentList documents={applicationDocs} />
        <div className="mt-4 border-t border-gray-100 pt-4">
          <UploadForm action={uploadSupportingDocAction.bind(null, app.id)} label="Upload document" />
        </div>
      </section>

      {/* Paperwork from GWA */}
      {gwaDocs.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Paperwork from GWA</h2>
          <p className="mb-3 text-xs text-gray-500">Documents from the GWA team — open to view or print.</p>
          <DocumentList documents={gwaDocs} />
        </section>
      )}

      {/* Payout receipt */}
      {app.payouts.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Payout receipt</h2>
          <PayoutReceipt payouts={app.payouts} />
        </section>
      )}

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
            <h3 className="text-sm font-medium text-gray-700">Funding documents</h3>
            <p className="text-xs text-gray-500">Upload these as you get them — you don&apos;t have to add them all at once.</p>
            {requiredFunding.map((t) => {
              const uploaded = fundingDocs.filter((d) => d.type === t.type);
              const done = uploaded.length > 0;
              return (
                <div key={t.type} className="rounded border border-gray-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                          done ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}
                        aria-hidden
                      >
                        {done ? '✓' : '✕'}
                      </span>
                      {t.label}
                      {!t.required && <span className="text-xs font-normal text-gray-400">(optional)</span>}
                    </span>
                    <span className={`badge ${done ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                      {done ? 'Uploaded' : 'Missing'}
                    </span>
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
                <span className="text-xs text-gray-500">{missingCount} still missing — you can submit now and add the rest later</span>
              )}
              <button type="submit" className="btn-primary">
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
