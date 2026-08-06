import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { canAccessAsDealer } from '@/lib/rbac';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentList } from '@/components/DocumentList';
import { PaperworkCards } from '@/components/PaperworkCards';
import { PayoutReceipt } from '@/components/PayoutReceipt';
import { NoteThread } from '@/components/NoteThread';
import { NoteForm } from '@/components/NoteForm';
import { ConfirmationBadge } from '@/components/ConfirmationBadge';
import { ConfirmationView } from '@/components/ConfirmationView';
import { DealProgress } from '@/components/DealProgress';
import { UploadForm } from '@/components/UploadForm';
import { SerialNumberForm } from '@/components/SerialNumberForm';
import { ProductSerialForm } from '@/components/ProductSerialForm';
import { FUNDING_DOCUMENT_TYPES, STATUS_LABELS, programLabel } from '@/lib/constants';
import { dealerFacingStatus } from '@/lib/reviewerFlow';
import { dealerOutstanding } from '@/lib/outstanding';
import {
  uploadSupportingDocAction,
  uploadFundingBatchAction,
  addSerialNumberAction,
  submitFundingAction,
  addDealerNoteAction,
  deleteOwnDocumentAction,
} from '@/app/(dealer)/actions';
import { FundingUploader } from '@/components/FundingUploader';
import { DeleteDocumentButton } from '@/components/DeleteDocumentButton';

export const dynamic = 'force-dynamic';

export default async function DealerApplicationDetail({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireDealerAccess();
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
      confirmation: { include: { confirmedBy: true } },
    },
  });
  if (!app || !canAccessAsDealer(user, app.dealerId)) notFound();

  const applicationDocs = app.documents.filter((d) => d.stage === 'APPLICATION');
  const fundingDocs = app.documents.filter((d) => d.stage === 'FUNDING');
  const gwaDocs = app.documents.filter((d) => d.stage === 'REVIEWER');
  const uploadedFundingTypes = new Set(fundingDocs.map((d) => d.type));

  // The dealer can upload funding documents throughout the funding window —
  // before AND after submitting — right up until the deal is funded.
  const canUploadFunding = ['APPROVED', 'CONDITIONAL', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW'].includes(app.status);
  const fundingVisible = canUploadFunding || app.status === 'FUNDED';
  const canSubmitFunding = ['APPROVED', 'CONDITIONAL', 'DOCS_SENT'].includes(app.status);

  // Serial-per-product rule (e.g. UEI): a serial is required for each selected
  // product before funding can be submitted.
  const requiresSerials = !!app.financeCompany?.requiresSerialPerProduct && app.productsSold.length > 0;
  const serialByProduct = new Map(
    app.serialNumbers.filter((s) => s.productLabel).map((s) => [s.productLabel as string, s.value]),
  );
  const productSerialValues = app.productsSold.map((p) => serialByProduct.get(p) ?? '');
  const serialsComplete =
    !requiresSerials || app.productsSold.every((p) => (serialByProduct.get(p) ?? '').trim().length > 0);

  const requiredFunding = FUNDING_DOCUMENT_TYPES;
  const missingCount = requiredFunding.filter(
    (t) => t.required && !uploadedFundingTypes.has(t.type),
  ).length;

  // What the dealer still has to do (drives the "What's needed" card up top).
  const outstanding = dealerOutstanding({
    status: app.status,
    productsSold: app.productsSold,
    requiresSerials,
    serialNumbers: app.serialNumbers,
    fundingDocs,
  });

  const submitFunding = submitFundingAction.bind(null, app.id);

  // Plain-language "where your deal stands", kept in step with the reviewer's flow.
  const whereYouStand = dealerFacingStatus({
    status: app.status,
    reviewerDocsSent: app.documents.some((d) => d.stage === 'REVIEWER'),
    fundingDocsReceived: app.documents.some((d) => d.stage === 'FUNDING'),
    hasPayouts: app.payouts.length > 0,
  });

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
        <p className="mt-2 text-sm text-gray-600">
          Where your deal stands: <span className="font-semibold text-brand-700">{whereYouStand}</span>
        </p>
      </div>

      {/* Progress tracker */}
      <DealProgress
        status={app.status}
        approvedById={app.approvedById}
        confirmationStatus={app.confirmationStatus}
        hasFundingDocs={app.documents.some((d) => d.stage === 'FUNDING')}
        hasPayouts={app.payouts.length > 0}
      />

      {/* What's needed from you — a self-serve "why is this stuck?" summary,
          shown only while the ball is in the dealer's court. */}
      {outstanding.hasAction && (
        <section className={`card border p-5 ${outstanding.readyToSubmit ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          <h2 className={`mb-2 text-base font-semibold ${outstanding.readyToSubmit ? 'text-green-800' : 'text-amber-900'}`}>
            {outstanding.readyToSubmit ? '✅ Ready to submit' : '⚠️ What’s needed from you'}
          </h2>
          <ul className="space-y-1.5 text-sm text-gray-700">
            {outstanding.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden className={outstanding.readyToSubmit ? 'text-green-600' : 'text-amber-600'}>›</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
          {fundingVisible && (
            <a href="#funding-package" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
              Go to funding package →
            </a>
          )}
        </section>
      )}

      {/* Customer snapshot — everything the dealer needs to recall this deal at a
          glance. The detailed application (employment, ID, income, housing) is
          not shown back to the dealer after intake. */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Customer snapshot</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-gray-500">Product(s) sold</dt>
            <dd className="font-medium">{app.productsSold.length ? app.productsSold.join(', ') : '—'}</dd>
          </div>
          <div><dt className="text-gray-500">Program</dt><dd className="font-medium">{programLabel(app.programType, app.programCategory)}</dd></div>
          <div><dt className="text-gray-500">Salesperson</dt><dd className="font-medium">{app.salespersonName ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Installer</dt><dd className="font-medium">{app.installerName ?? '—'}</dd></div>
          <div><dt className="text-gray-500">SOAP included</dt><dd className="font-medium">{app.soapIncluded == null ? '—' : app.soapIncluded ? 'Yes' : 'No'}</dd></div>
          <div><dt className="text-gray-500">Requested</dt><dd className="font-medium">${app.requestedAmount.toString()}</dd></div>
          <div><dt className="text-gray-500">Approved amount</dt><dd className="font-medium">{app.approvedAmount ? `$${app.approvedAmount.toString()}` : '—'}</dd></div>
          <div><dt className="text-gray-500">Finance company</dt><dd className="font-medium">{app.financeCompany?.name ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Date of sale</dt><dd className="font-medium">{app.dateOfSale ? app.dateOfSale.toLocaleDateString('en-CA') : '—'}</dd></div>
          <div><dt className="text-gray-500">Installation date</dt><dd className="font-medium">{app.installationDate ? app.installationDate.toLocaleDateString('en-CA') : '—'}</dd></div>
          <div><dt className="text-gray-500">HD store</dt><dd className="font-medium">{app.homeDepotStore ? app.homeDepotStore.number : '—'}</dd></div>
          <div><dt className="text-gray-500">City</dt><dd className="font-medium">{app.loanApplication?.city ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Province</dt><dd className="font-medium">{app.province}</dd></div>
          <div><dt className="text-gray-500">Postal code</dt><dd className="font-medium">{app.loanApplication?.postalCode ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{app.applicantPhone}</dd></div>
          <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{app.applicantEmail}</dd></div>
          <div><dt className="text-gray-500">Financing deal number</dt><dd className="font-medium">{app.financeItNumber ?? '—'}</dd></div>
          <div><dt className="text-gray-500">HD Customer #</dt><dd className="font-medium">{app.hdReference ?? '—'}</dd></div>
        </dl>
        {app.financingNote && (
          <p className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-600"><span className="font-medium text-gray-700">Financing note: </span>{app.financingNote}</p>
        )}
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

      {/* The full loan-application details (employment, ID, income, housing,
          co-applicant) are intentionally NOT shown back to the dealer — the GWA
          review team has them. */}

      {/* Confirmation */}
      <section className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Confirmation</h2>
          <ConfirmationBadge status={app.confirmationStatus} />
        </div>
        {app.confirmation && app.confirmationStatus !== 'PENDING' ? (
          <ConfirmationView c={app.confirmation} />
        ) : (
          <p className="text-sm text-gray-500">This deal has not been confirmed yet.</p>
        )}
      </section>

      {/* Chat with the Reviewer */}
      <section className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Chat with the Reviewer</h2>
        <div className="mb-4">
          <NoteThread notes={app.dealNotes} emptyText="No messages yet. Use this to chat with the reviewer about this deal." />
        </div>
        <NoteForm
          action={addDealerNoteAction.bind(null, app.id)}
          placeholder="Write a message to the reviewer…"
          label="Send"
        />
      </section>

      {/* Documents for approval */}
      <section className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Documents for approval</h2>
        <DocumentList documents={applicationDocs} deleteAction={deleteOwnDocumentAction} />
        <div className="mt-4 border-t border-gray-100 pt-4">
          <UploadForm action={uploadSupportingDocAction.bind(null, app.id)} label="Upload document" />
        </div>
      </section>

      {/* Paperwork for your Customer */}
      {gwaDocs.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Paperwork for your Customer</h2>
          <p className="mb-4 text-xs text-gray-500">Documents from the GWA team — view in your browser or download to share with your customer.</p>
          <PaperworkCards documents={gwaDocs} />
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
      {fundingVisible && (
        <section id="funding-package" className="card scroll-mt-4 p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Funding package</h2>
            <span className="text-xs text-gray-500">Status: {STATUS_LABELS[app.status]}</span>
          </div>
          <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-400 align-middle" />Missing</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400 align-middle" />Uploaded — pending GWA review</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500 align-middle" />Confirmed by GWA</span>
          </p>

          {/* Serial numbers */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Serial number(s)</h3>
            {requiresSerials ? (
              // One required serial per selected product (finance-company rule).
              canUploadFunding ? (
                <ProductSerialForm applicationId={app.id} products={app.productsSold} values={productSerialValues} />
              ) : (
                <ul className="space-y-1 text-sm">
                  {app.productsSold.map((p) => (
                    <li key={p} className="text-gray-700">
                      <span className="font-mono">{serialByProduct.get(p) || '—'}</span>
                      <span className="ml-2 text-gray-400">({p})</span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <>
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
                {canUploadFunding && <SerialNumberForm action={addSerialNumberAction.bind(null, app.id)} />}
              </>
            )}
          </div>

          {/* Funding document checklist */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Funding documents</h3>
            <p className="text-xs text-gray-500">Upload these as you get them — you don&apos;t have to add them all at once.</p>

            {canUploadFunding && (
              <FundingUploader
                action={uploadFundingBatchAction.bind(null, app.id)}
                categories={FUNDING_DOCUMENT_TYPES.map((t) => ({ type: t.type, label: t.label }))}
              />
            )}
            {requiredFunding.map((t) => {
              const uploaded = fundingDocs.filter((d) => d.type === t.type);
              const confirmed = uploaded.some((d) => d.verifiedAt);
              const state = confirmed ? 'confirmed' : uploaded.length > 0 ? 'pending' : 'missing';
              const badgeCls =
                state === 'confirmed' ? 'bg-green-100 text-green-800'
                  : state === 'pending' ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-700';
              const badgeLabel = state === 'confirmed' ? 'Confirmed' : state === 'pending' ? 'Pending review' : 'Missing';
              const dotCls =
                state === 'confirmed' ? 'bg-green-100 text-green-700'
                  : state === 'pending' ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-600';
              const dotIcon = state === 'confirmed' ? '✓' : state === 'pending' ? '!' : '✕';
              // Shade the whole card by state (red missing / amber pending /
              // green confirmed). The upload dropzone inside stays white.
              const cardCls =
                state === 'confirmed' ? 'border-green-300 bg-green-50'
                  : state === 'pending' ? 'border-amber-300 bg-amber-50'
                    : 'border-red-300 bg-red-50';
              return (
                <div key={t.type} className={`rounded border p-3 ${cardCls}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${dotCls}`} aria-hidden>
                        {dotIcon}
                      </span>
                      {t.label}
                      {!t.required && <span className="text-xs font-normal text-gray-400">(optional)</span>}
                    </span>
                    <span className={`badge ${badgeCls}`}>{badgeLabel}</span>
                  </div>
                  {uploaded.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-7 text-xs text-gray-500">
                      {uploaded.map((u) => (
                        <li key={u.id} className="flex flex-wrap items-center gap-2">
                          <a href={`/api/documents/${u.id}`} target="_blank" rel="noopener noreferrer" className="break-all text-brand-700 hover:underline">
                            {u.fileName}
                          </a>
                          {u.verifiedAt ? (
                            <span className="text-green-600">✓ confirmed by GWA</span>
                          ) : (
                            canUploadFunding && <DeleteDocumentButton documentId={u.id} fileName={u.fileName} action={deleteOwnDocumentAction} />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {canSubmitFunding && (
            <form action={submitFunding} className="mt-6 flex flex-wrap items-center justify-end gap-3">
              {!serialsComplete && (
                <span className="text-xs font-medium text-amber-700">
                  Enter a serial number for every product above before submitting.
                </span>
              )}
              {serialsComplete && missingCount > 0 && (
                <span className="text-xs text-gray-500">{missingCount} still missing — you can submit now and add the rest later</span>
              )}
              <button type="submit" className="btn-primary" disabled={!serialsComplete}>
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
