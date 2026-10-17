import Link from 'next/link';
import type { Application, LoanApplication, HomeDepotStore, FinanceCompany, User } from '@prisma/client';
import { programDisplayLabel, soapDisplayLabel, paymentMethodLabel } from '@/lib/enumLabels';
import { financeCompanyDisplay } from '@/lib/constants';
import type { TFunction } from '@/i18n/translator';
import { AutoTranslate } from './AutoTranslate';
import { readEnc } from '@/lib/crypto';
import { netBeforeTax } from '@/lib/tax';

/**
 * Reviewer entry view — the whole application laid out top-to-bottom in the
 * order a lender's form asks for it, so a reviewer can read straight down while
 * re-keying it into another finance company. Protected fields (DOB, street
 * address, ID numbers) are decrypted+audited by the page and passed in here as
 * ready-to-show strings; this component contains no crypto.
 */

type AppForEntry = Application & {
  homeDepotStore: HomeDepotStore | null;
  financeCompany: FinanceCompany | null;
  approvedBy: User | null;
};

export interface ProtectedValues {
  dob: string;
  address: string;
  govId: string;
  coDob: string;
  coAddress: string;
  coGovId: string;
}

function nonEmpty(v: string | null | undefined): string | null {
  return v && v.trim() ? v : null;
}
function fmtDate(d: Date | null | undefined): string | null {
  return d ? d.toLocaleDateString('en-CA') : null;
}
function money(v: { toString(): string } | null | undefined): string | null {
  return v == null ? null : `$${v.toString()}`;
}
function joinName(...parts: (string | null | undefined)[]): string | null {
  const s = parts.filter((p) => p && p.trim()).join(' ').trim();
  return s || null;
}
function addressLine(...parts: (string | null | undefined)[]): string | null {
  const s = parts.filter((p) => p && p.trim()).join(', ');
  return s || null;
}

// Reviewer-side values render in UPPERCASE so they copy straight into HD /
// finance systems (which use caps). This uppercases the actual string — not just
// CSS text-transform, which would copy back as the original case. `raw` opts a
// field out (e.g. email, where caps can break the address).
function Field({ label, value, mono, raw }: { label: string; value: React.ReactNode; mono?: boolean; raw?: boolean }) {
  const display = !raw && typeof value === 'string' ? value.toUpperCase() : value;
  return (
    <div className="flex flex-col gap-0.5 border-b border-gray-100 py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-xs uppercase tracking-wide text-gray-400 sm:w-56 sm:flex-none">{label}</dt>
      <dd className={`min-w-0 break-words text-sm font-medium text-gray-900 sm:flex-1 ${mono ? 'font-mono' : ''}`}>
        {display === null || display === undefined || display === '' ? <span className="text-gray-300">—</span> : display}
      </dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 first:mt-0">
      <h3 className="mb-2 border-b-2 border-brand-100 pb-1.5 text-lg font-bold uppercase tracking-wide text-brand-700">{title}</h3>
      <dl>{children}</dl>
    </div>
  );
}

export function ReviewerEntryView({
  app,
  loan,
  reveal,
  pv,
  revealHref,
  hideHref,
  printHref,
  t,
}: {
  app: AppForEntry;
  loan: LoanApplication | null;
  reveal: boolean;
  pv: ProtectedValues;
  revealHref: string;
  hideHref: string;
  printHref?: string;
  t: TFunction;
}) {
  const hasCo = !!(loan?.coFirstName || loan?.coLastName);
  const otherAddresses = [
    addressLine(readEnc(loan?.mailingAddressEnc, loan?.mailingAddress), loan?.mailingCity, loan?.mailingProvince, loan?.mailingPostal),
    addressLine(readEnc(loan?.previousAddressEnc, loan?.previousAddress), loan?.previousCity, loan?.previousProvince, loan?.previousPostal),
    addressLine(readEnc(loan?.worksiteAddressEnc, loan?.worksiteAddress), loan?.worksiteCity, loan?.worksiteProvince, loan?.worksitePostal),
  ];
  const hasOther = otherAddresses.some(Boolean);
  const storeLabel = app.homeDepotStore
    ? app.homeDepotStore.name
      ? `${app.homeDepotStore.name} — ${app.homeDepotStore.number}`
      : app.homeDepotStore.number
    : null;

  return (
    <section className="card p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{t('reviewerEntry.heading')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {printHref && (
            <a href={printHref} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
              {t('reviewerEntry.openFullApplication')}
            </a>
          )}
          {reveal ? (
            <Link href={hideHref} className="text-xs text-brand-700 hover:underline">
              {t('reviewerEntry.hideProtected')}
            </Link>
          ) : (
            <Link href={revealHref} prefetch={false} className="btn-secondary text-xs">
              {t('reviewerEntry.revealProtected')}
            </Link>
          )}
        </div>
      </div>
      <p className="mb-2 text-xs text-gray-500">
        {t('reviewerEntry.readTopToBottom')}
      </p>
      {reveal && (
        <p className="mb-4 rounded bg-amber-50 p-2 text-xs text-amber-700">
          {t('reviewerEntry.protectedShownNotice')}
        </p>
      )}

      <Group title={t('reviewerEntry.group.personalDetails')}>
        <Field label={t('reviewerEntry.field.fullName')} value={joinName(app.applicantFirstName, loan?.middleName, app.applicantLastName)} />
        <Field label={t('reviewerEntry.field.birthdate')} value={pv.dob} />
        <Field label={t('reviewerEntry.field.maritalStatus')} value={nonEmpty(loan?.maritalStatus)} />
        <Field label={t('reviewerEntry.field.homePhone')} value={nonEmpty(loan?.homePhone)} />
        <Field label={t('reviewerEntry.field.mobilePhone')} value={app.applicantPhone} />
        <Field label={t('reviewerEntry.field.email')} value={app.applicantEmail} raw />
      </Group>

      <Group title={t('reviewerEntry.group.housing')}>
        <Field label={t('reviewerEntry.field.address')} value={pv.address} />
        <Field label={t('reviewerEntry.field.city')} value={nonEmpty(loan?.city) ?? nonEmpty(app.applicantCity)} />
        <Field label={t('reviewerEntry.field.province')} value={nonEmpty(loan?.addressProvince) ?? app.province} />
        <Field label={t('reviewerEntry.field.postalCode')} value={nonEmpty(loan?.postalCode) ?? nonEmpty(app.applicantPostal)} />
        <Field label={t('reviewerEntry.field.yearsAtAddress')} value={loan?.yearsAtAddress ?? null} />
        <Field label={t('reviewerEntry.field.monthlyHousingCosts')} value={money(readEnc(loan?.monthlyHousingCostEnc, loan?.monthlyHousingCost))} />
        <Field label={t('reviewerEntry.field.housingStatus')} value={loan?.housingStatus ? t(`reviewerEntry.housingValue.${loan.housingStatus}`) : null} />
      </Group>

      {hasOther && (
        <Group title={t('reviewerEntry.group.otherAddresses')}>
          <Field label={t('reviewerEntry.field.mailingAddress')} value={otherAddresses[0]} />
          <Field label={t('reviewerEntry.field.previousAddress')} value={otherAddresses[1]} />
          <Field label={t('reviewerEntry.field.worksiteAddress')} value={otherAddresses[2]} />
        </Group>
      )}

      <Group title={t('reviewerEntry.group.borrowerId')}>
        <Field label={t('reviewerEntry.field.photoIdType')} value={nonEmpty(loan?.idType)} />
        <Field label={t('reviewerEntry.field.photoIdNumber')} value={pv.govId} mono />
        <Field label={t('reviewerEntry.field.photoIdProvince')} value={nonEmpty(loan?.idProvince)} />
        <Field label={t('reviewerEntry.field.photoIdExpiry')} value={fmtDate(loan?.idExpiry)} />
      </Group>

      <Group title={t('reviewerEntry.group.employmentIncome')}>
        <Field label={t('reviewerEntry.field.businessName')} value={nonEmpty(loan?.businessName)} />
        <Field label={t('reviewerEntry.field.positionTitle')} value={nonEmpty(loan?.positionTitle)} />
        <Field label={t('reviewerEntry.field.employerAddress')} value={nonEmpty(readEnc(loan?.employerAddressEnc, loan?.employerAddress))} />
        <Field label={t('reviewerEntry.field.employerPhone')} value={nonEmpty(loan?.employerPhone)} />
        <Field label={t('reviewerEntry.field.timeAtJob')} value={loan?.timeAtJobYears ?? null} />
        <Field label={t('reviewerEntry.field.grossMonthlyIncome')} value={money(readEnc(loan?.grossMonthlyIncomeEnc, loan?.grossMonthlyIncome))} />
        <Field label={t('reviewerEntry.field.employmentStatus')} value={loan?.employmentStatus ? t(`reviewerEntry.employmentValue.${loan.employmentStatus}`) : null} />
      </Group>

      {hasCo && loan && (
        <div className="mt-6 rounded-lg border border-brand-100 bg-brand-50/40 p-4">
          <h3 className="mb-1 text-sm font-semibold text-brand-900">
            {t('reviewerEntry.coApplicant')}{nonEmpty(loan.coRelationship) ? ` · ${loan.coRelationship}` : ''}
          </h3>
          <Group title={t('reviewerEntry.group.personalDetails')}>
            <Field label={t('reviewerEntry.field.fullName')} value={joinName(loan.coFirstName, loan.coMiddleName, loan.coLastName)} />
            <Field label={t('reviewerEntry.field.birthdate')} value={pv.coDob} />
            <Field label={t('reviewerEntry.field.maritalStatus')} value={nonEmpty(loan.coMaritalStatus)} />
            <Field label={t('reviewerEntry.field.homePhone')} value={nonEmpty(loan.coHomePhone)} />
            <Field label={t('reviewerEntry.field.mobilePhone')} value={nonEmpty(loan.coPhone)} />
            <Field label={t('reviewerEntry.field.email')} value={nonEmpty(loan.coEmail)} raw />
          </Group>
          <Group title={t('reviewerEntry.group.housing')}>
            <Field label={t('reviewerEntry.field.address')} value={pv.coAddress} />
            <Field label={t('reviewerEntry.field.city')} value={nonEmpty(loan.coCity)} />
            <Field label={t('reviewerEntry.field.province')} value={nonEmpty(loan.coProvince)} />
            <Field label={t('reviewerEntry.field.postalCode')} value={nonEmpty(loan.coPostal)} />
          </Group>
          <Group title={t('reviewerEntry.group.borrowerId')}>
            <Field label={t('reviewerEntry.field.photoIdType')} value={nonEmpty(loan.coIdType)} />
            <Field label={t('reviewerEntry.field.photoIdNumber')} value={pv.coGovId} mono />
            <Field label={t('reviewerEntry.field.photoIdProvince')} value={nonEmpty(loan.coIdProvince)} />
            <Field label={t('reviewerEntry.field.photoIdExpiry')} value={fmtDate(loan.coIdExpiry)} />
          </Group>
          <Group title={t('reviewerEntry.group.employmentIncome')}>
            <Field label={t('reviewerEntry.field.businessName')} value={nonEmpty(loan.coBusinessName)} />
            <Field label={t('reviewerEntry.field.positionTitle')} value={nonEmpty(loan.coPositionTitle)} />
            <Field label={t('reviewerEntry.field.employerAddress')} value={nonEmpty(readEnc(loan.coEmployerAddressEnc, loan.coEmployerAddress))} />
            <Field label={t('reviewerEntry.field.employerPhone')} value={nonEmpty(loan.coEmployerPhone)} />
            <Field label={t('reviewerEntry.field.timeAtJob')} value={loan.coTimeAtJobYears ?? null} />
            <Field label={t('reviewerEntry.field.grossMonthlyIncome')} value={money(readEnc(loan.coGrossMonthlyIncomeEnc, loan.coGrossMonthlyIncome))} />
            <Field label={t('reviewerEntry.field.employmentStatus')} value={loan.coEmploymentStatus ? t(`reviewerEntry.employmentValue.${loan.coEmploymentStatus}`) : null} />
          </Group>
        </div>
      )}

      <Group title={t('reviewerEntry.group.financingDeal')}>
        <Field label={t('reviewerEntry.field.program')} value={programDisplayLabel(t, app.programType, app.programCategory)} />
        <Field label={t('reviewerEntry.field.requestedAmount')} value={money(app.requestedAmount)} />
        {(() => {
          const total = Number(app.approvedAmount ?? app.requestedAmount) || 0;
          const n = netBeforeTax(total, app.province);
          const fmt = (x: number) => `$${x.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const label = n.rate > 0 ? t('reviewerEntry.netPreTaxWithRate', { province: app.province, rate: n.ratePct }) : t('reviewerEntry.netPreTax');
          return (
            <>
              <Field label={label} value={fmt(n.net)} />
              {n.rate > 0 && (
                <Field label={t('reviewerEntry.taxAmount', { province: app.province, rate: n.ratePct })} value={fmt(total - n.net)} />
              )}
            </>
          );
        })()}
        <Field label={t('reviewerEntry.field.approvedAmount')} value={money(app.approvedAmount)} />
        <Field label={t('reviewerEntry.field.paymentMethod')} value={app.paymentMethod ? paymentMethodLabel(t, app.paymentMethod) : t('reviewerEntry.notSpecified')} />
        <Field label={t('reviewerEntry.field.financeCompany')} value={financeCompanyDisplay(app)} />
        <Field label={t('reviewerEntry.field.homeDepotStore')} value={storeLabel} />
        <Field label={t('reviewerEntry.field.dateOfSale')} value={fmtDate(app.dateOfSale)} />
        <Field label={t('reviewerEntry.field.installationDate')} value={fmtDate(app.installationDate)} />
        <Field label={t('reviewerEntry.field.productsSold')} value={app.productsSold.length ? app.productsSold.join(', ') : null} />
        <Field label={t('reviewerEntry.field.soapIncluded')} value={soapDisplayLabel(t, app.soapType, app.soapIncluded)} />
        <Field label={t('reviewerEntry.field.salesperson')} value={nonEmpty(app.salespersonName)} />
        <Field label={t('reviewerEntry.field.installer')} value={nonEmpty(app.installerName)} />
        <Field label={t('reviewerEntry.field.financingDealNumber')} value={nonEmpty(app.financeItNumber)} mono />
        <Field label={t('reviewerEntry.field.hdCustomerNumber')} value={nonEmpty(app.hdReference)} mono />
        <Field label={t('reviewerEntry.field.entryMethod')} value={app.entryMethod === 'TYPED' ? t('reviewerEntry.entryMethod.TYPED') : app.entryMethod === 'PHOTO' ? t('reviewerEntry.entryMethod.PHOTO') : app.entryMethod === 'DIRECT' ? t('reviewerEntry.entryMethod.DIRECT') : t('reviewerEntry.entryMethod.FINANCEIT')} />
        <Field label={t('reviewerEntry.field.approvedBy')} value={app.approvedBy?.name ?? null} />
      </Group>

      {(app.financingNote || app.notes) && (
        <Group title={t('reviewerEntry.group.notes')}>
          {app.financingNote && (
            <div className="rounded bg-gray-50 p-3 text-sm text-gray-600">
              <span className="font-medium text-gray-700">{t('reviewerEntry.financingNoteLabel')}</span>
              <AutoTranslate text={app.financingNote} className="inline-block align-top" />
            </div>
          )}
          {app.notes && <div className="mt-2 rounded bg-gray-50 p-3 text-sm text-gray-600"><AutoTranslate text={app.notes} /></div>}
        </Group>
      )}
    </section>
  );
}
