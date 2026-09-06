import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { canAccessAsDealer } from '@/lib/rbac';
import { StatusBadge } from '@/components/StatusBadge';
import { DocumentList } from '@/components/DocumentList';
import { PaperworkCards } from '@/components/PaperworkCards';
import { PayoutReceipt } from '@/components/PayoutReceipt';
import { ConfirmationBadge } from '@/components/ConfirmationBadge';
import { ConfirmationView } from '@/components/ConfirmationView';
import { DealProgress } from '@/components/DealProgress';
import { UploadForm } from '@/components/UploadForm';
import { SerialNumberForm } from '@/components/SerialNumberForm';
import { ProductSerialForm } from '@/components/ProductSerialForm';
import { fundingDocumentTypesFor, REVIEWER_DISPLAY, decisionTone } from '@/lib/constants';
import { programDisplayLabel, soapDisplayLabel, decisionDisplayLabel } from '@/lib/enumLabels';
import { getT } from '@/i18n/server';
import { dealerFacingStatusLabel, hasDealerReturned } from '@/lib/reviewerFlow';
import { dealerOutstanding } from '@/lib/outstanding';
import {
  uploadSupportingDocAction,
  uploadFundingBatchAction,
  addSerialNumberAction,
  submitFundingAction,
  deleteOwnDocumentAction,
} from '@/app/(dealer)/actions';
import { FundingItemUploader } from '@/components/FundingItemUploader';
import { DeleteDocumentButton } from '@/components/DeleteDocumentButton';
import { DocViewer } from '@/components/DocViewer';

export const dynamic = 'force-dynamic';

export default async function DealerApplicationDetail({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireDealerAccess();
  const t = getT();
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

  // GWA program deals don't involve Home Depot, so the HD documents/waiver drop
  // off the funding checklist entirely.
  const requiredFunding = fundingDocumentTypesFor(app.programType, {
    paymentMethod: app.paymentMethod,
    isSplitPayment: app.isSplitPayment,
  });
  const missingCount = requiredFunding.filter(
    (t) => t.required && !uploadedFundingTypes.has(t.type),
  ).length;

  // What the dealer still has to do (drives the "What's needed" card up top).
  const outstanding = dealerOutstanding({
    status: app.status,
    programType: app.programType,
    paymentMethod: app.paymentMethod,
    isSplitPayment: app.isSplitPayment,
    productsSold: app.productsSold,
    requiresSerials,
    serialNumbers: app.serialNumbers,
    fundingDocs,
  });

  const submitFunding = submitFundingAction.bind(null, app.id);

  // Once the dealer has returned anything (even to the wrong upload box), the
  // deal is "back with GWA" — keep this in step with the reviewer's flow.
  const dealerReturned = hasDealerReturned(app.documents);

  // Plain-language "where your deal stands", kept in step with the reviewer's flow.
  const whereYouStand = dealerFacingStatusLabel(t, {
    status: app.status,
    reviewerDocsSent: app.documents.some((d) => d.stage === 'REVIEWER'),
    fundingDocsReceived: dealerReturned,
    hasPayouts: app.payouts.length > 0,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dealer" className="text-sm text-gray-500 hover:underline">
          {t('dealDetail.backToApplications')}
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            {app.applicantFirstName} {app.applicantLastName}
          </h1>
          <StatusBadge status={app.status} />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          {t('dealDetail.whereYouStand')} <span className="font-semibold text-brand-700">{whereYouStand}</span>
        </p>
      </div>

      {/* Progress tracker */}
      <DealProgress
        status={app.status}
        approvedById={app.approvedById}
        confirmationStatus={app.confirmationStatus}
        hasFundingDocs={dealerReturned}
        hasPayouts={app.payouts.length > 0}
      />

      {/* What's needed from you — a self-serve "why is this stuck?" summary,
          shown only while the ball is in the dealer's court. */}
      {outstanding.hasAction && (
        <section className={`card border p-5 ${outstanding.readyToSubmit ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          <h2 className={`mb-2 text-base font-semibold ${outstanding.readyToSubmit ? 'text-green-800' : 'text-amber-900'}`}>
            {outstanding.readyToSubmit ? t('dealDetail.readyToSubmit') : t('dealDetail.whatsNeeded')}
          </h2>
          <ul className={`space-y-1.5 text-sm ${outstanding.readyToSubmit ? 'text-green-900' : 'text-amber-900'}`}>
            {outstanding.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden className={outstanding.readyToSubmit ? 'text-green-600' : 'text-amber-600'}>›</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
          {fundingVisible && (
            <a href="#funding-package" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">
              {t('dealDetail.goToFunding')}
            </a>
          )}
        </section>
      )}

      {/* Customer snapshot — everything the dealer needs to recall this deal at a
          glance. The detailed application (employment, ID, income, housing) is
          not shown back to the dealer after intake. */}
      <section className="card p-6">
        <h2 className="mb-4 border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">{t('dealDetail.customerSnapshot')}</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 [&>div]:min-w-0 [&_dd]:break-words">
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-gray-500">{t('dealDetail.productsSold')}</dt>
            <dd className="font-medium">{app.productsSold.length ? app.productsSold.join(', ') : '—'}</dd>
          </div>
          <div><dt className="text-gray-500">{t('dealDetail.program')}</dt><dd className="font-medium">{programDisplayLabel(t, app.programType, app.programCategory)}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.salesperson')}</dt><dd className="font-medium">{app.salespersonName ?? '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.installer')}</dt><dd className="font-medium">{app.installerName ?? '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.soapIncluded')}</dt><dd className="font-medium">{soapDisplayLabel(t, app.soapType, app.soapIncluded) ?? '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.requested')}</dt><dd className="font-medium">${app.requestedAmount.toString()}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.approvedAmount')}</dt><dd className="font-medium">{app.approvedAmount ? `$${app.approvedAmount.toString()}` : '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.financeCompany')}</dt><dd className="font-medium">{app.financeCompany?.name ?? '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.dateOfSale')}</dt><dd className="font-medium">{app.dateOfSale ? app.dateOfSale.toLocaleDateString('en-CA') : '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.installationDate')}</dt><dd className="font-medium">{app.installationDate ? app.installationDate.toLocaleDateString('en-CA') : '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.hdStore')}</dt><dd className="font-medium">{app.homeDepotStore ? app.homeDepotStore.number : '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.city')}</dt><dd className="font-medium">{app.loanApplication?.city ?? '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.province')}</dt><dd className="font-medium">{app.province}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.postalCode')}</dt><dd className="font-medium">{app.loanApplication?.postalCode ?? '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.phone')}</dt><dd className="font-medium">{app.applicantPhone}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.email')}</dt><dd className="font-medium">{app.applicantEmail}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.financingDealNumber')}</dt><dd className="font-medium">{app.financeItNumber ?? '—'}</dd></div>
          <div><dt className="text-gray-500">{t('dealDetail.hdCustomerNumber')}</dt><dd className="font-medium">{app.hdReference ?? '—'}</dd></div>
        </dl>
        {app.financingNote && (
          <p className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-600"><span className="font-medium text-gray-700">{t('dealDetail.financingNoteLabel')}</span>{app.financingNote}</p>
        )}
      </section>

      {/* Decisions / reviewer notes */}
      {app.decisions.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-3 border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">{t('dealDetail.reviewDecisions')}</h2>
          <ul className="space-y-2 text-sm">
            {app.decisions.map((d) => {
              const tone = decisionTone(d.type);
              return (
                <li key={d.id} className={`rounded border p-3 ${tone.card}`}>
                  <span className={`font-semibold ${tone.label}`}>{decisionDisplayLabel(t, d.type)}</span>
                  {d.notes && <p className="mt-1 text-gray-700">{d.notes}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    {REVIEWER_DISPLAY} · {d.createdAt.toLocaleString('en-CA')}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* The full loan-application details (employment, ID, income, housing,
          co-applicant) are intentionally NOT shown back to the dealer — the GWA
          review team has them. */}

      {/* Confirmation */}
      <section className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">{t('dealDetail.confirmation')}</h2>
          <ConfirmationBadge status={app.confirmationStatus} />
        </div>
        {app.confirmation && app.confirmationStatus !== 'PENDING' ? (
          <ConfirmationView c={app.confirmation} anonymizeStaff />
        ) : (
          <p className="text-sm text-gray-500">{t('dealDetail.notConfirmedYet')}</p>
        )}
      </section>

      {/* Documents for approval */}
      <section className="card p-6">
        <h2 className="mb-3 border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">{t('dealDetail.documentsForApproval')}</h2>
        <DocumentList documents={applicationDocs} deleteAction={deleteOwnDocumentAction} />
        <div className="mt-4 border-t border-gray-100 pt-4">
          <UploadForm
            action={uploadSupportingDocAction.bind(null, app.id)}
            label={t('dealDetail.uploadDocument')}
            categories={[
              { value: 'BILL_OF_SALE', label: t('dealDetail.catBillOfSale') },
              { value: 'APPLICATION_INFO', label: t('dealDetail.catApplicationInfo') },
              { value: 'OTHER', label: t('dealDetail.catOther') },
            ]}
          />
        </div>
      </section>

      {/* Paperwork for your Customer */}
      {gwaDocs.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-1 border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">{t('dealDetail.paperworkForCustomer')}</h2>
          <p className="mb-4 text-xs text-gray-500">{t('dealDetail.paperworkHint')}</p>
          <PaperworkCards documents={gwaDocs} />
        </section>
      )}

      {/* Payout receipt — money paid to the dealer, so only the distributor
          (owner / main contact) sees it, not every dealer user. */}
      {user.isDistributor && app.payouts.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-3 border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">{t('dealDetail.payoutReceipt')}</h2>
          <PayoutReceipt payouts={app.payouts} />
        </section>
      )}

      {/* Funding stage */}
      {fundingVisible && (
        <section id="funding-package" className="card scroll-mt-4 p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">{t('dealDetail.fundingPackage')}</h2>
            <span className="text-xs text-gray-500">{t('dealDetail.statusPrefix')} {t(`enum.status.${app.status}`)}</span>
          </div>
          <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-400 align-middle" />{t('dealDetail.legendMissing')}</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400 align-middle" />{t('dealDetail.legendUploaded')}</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500 align-middle" />{t('dealDetail.legendConfirmed')}</span>
          </p>

          {/* Serial numbers */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-gray-700">{t('dealDetail.serialNumbers')}</h3>
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
                  <p className="mb-3 text-sm text-gray-500">{t('dealDetail.noSerialsYet')}</p>
                )}
                {canUploadFunding && <SerialNumberForm action={addSerialNumberAction.bind(null, app.id)} />}
              </>
            )}
          </div>

          {/* Funding document checklist */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">{t('dealDetail.fundingDocuments')}</h3>
            <p className="text-xs text-gray-500">{t('dealDetail.fundingDocsHint')}</p>
            {canUploadFunding && (
              <p className="text-xs text-amber-700">{t('dealDetail.noPaymentCards')}</p>
            )}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {requiredFunding.map((ft) => {
              const uploaded = fundingDocs.filter((d) => d.type === ft.type);
              const confirmed = uploaded.some((d) => d.verifiedAt);
              const state = confirmed ? 'confirmed' : uploaded.length > 0 ? 'pending' : 'missing';
              const badgeCls =
                state === 'confirmed' ? 'bg-green-100 text-green-800'
                  : state === 'pending' ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-700';
              const badgeLabel = state === 'confirmed' ? t('dealDetail.badgeConfirmed') : state === 'pending' ? t('dealDetail.badgePendingReview') : t('dealDetail.badgeMissing');
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
                <div key={ft.type} className={`rounded border p-3 ${cardCls}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">
                      <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${dotCls}`} aria-hidden>
                        {dotIcon}
                      </span>
                      {ft.label}
                      {!ft.required && <span className="text-xs font-normal text-gray-400">{t('dealDetail.optional')}</span>}
                    </span>
                    <span className={`badge ${badgeCls}`}>{badgeLabel}</span>
                  </div>
                  {uploaded.length > 0 && (
                    <div className="mt-1.5 pl-8 text-xs">
                      <span className="font-medium text-green-700">
                        ✓ {confirmed ? t('dealDetail.uploadCompleteConfirmed') : t('dealDetail.uploadedPending')}
                        {uploaded.length > 1 ? ` · ${t('dealDetail.filesCount', { n: uploaded.length })}` : ''}
                      </span>
                      <span className="ml-3 inline-flex flex-wrap gap-3 text-gray-500">
                        {uploaded.map((u, i) => (
                          <span key={u.id} className="inline-flex items-center gap-2">
                            <DocViewer id={u.id} fileName={u.fileName} mimeType={u.mimeType} className="text-brand-700 hover:underline">
                              {t('dealDetail.view')}{uploaded.length > 1 ? ` ${i + 1}` : ''}
                            </DocViewer>
                            {!u.verifiedAt && canUploadFunding && (
                              <DeleteDocumentButton documentId={u.id} fileName={u.fileName} action={deleteOwnDocumentAction} />
                            )}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  {canUploadFunding && !confirmed && (
                    <div className="pl-8">
                      <FundingItemUploader
                        action={uploadFundingBatchAction.bind(null, app.id)}
                        category={ft.type}
                        isOther={ft.type === 'OTHER'}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>

          {canSubmitFunding && (
            <form action={submitFunding} className="mt-6 flex flex-wrap items-center justify-end gap-3">
              {!serialsComplete && (
                <span className="text-xs font-medium text-amber-700">
                  {t('dealDetail.serialPerProductWarning')}
                </span>
              )}
              {serialsComplete && missingCount > 0 && (
                <span className="text-xs text-gray-500">{t('dealDetail.stillMissing', { n: missingCount })}</span>
              )}
              <button type="submit" className="btn-primary" disabled={!serialsComplete}>
                {t('dealDetail.submitFundingPackage')}
              </button>
            </form>
          )}
        </section>
      )}

      {/* Status history */}
      <section className="card p-6">
        <h2 className="mb-3 border-l-4 border-brand-500 pl-2.5 text-lg font-bold text-gray-900">{t('dealDetail.history')}</h2>
        <ul className="space-y-2 text-sm">
          {app.statusEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between">
              <span>
                {e.from ? `${t(`enum.status.${e.from}`)} → ` : ''}
                <span className="font-medium">{t(`enum.status.${e.to}`)}</span>
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
