import Link from 'next/link';
import type { Application, LoanApplication, HomeDepotStore, FinanceCompany, User } from '@prisma/client';
import { programLabel } from '@/lib/constants';
import { readEnc } from '@/lib/crypto';

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

const HOUSING: Record<string, string> = { OWN: 'Own', RENT: 'Rent', OTHER: 'Other' };
const EMPLOYMENT: Record<string, string> = {
  EMPLOYED: 'Employed',
  SELF_EMPLOYED: 'Self-employed',
  RETIRED: 'Retired',
  OTHER: 'Other',
};

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

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-gray-100 py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-xs uppercase tracking-wide text-gray-400 sm:w-56 sm:flex-none">{label}</dt>
      <dd className={`text-sm font-medium text-gray-900 sm:flex-1 ${mono ? 'font-mono' : ''}`}>
        {value === null || value === undefined || value === '' ? <span className="text-gray-300">—</span> : value}
      </dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 first:mt-0">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">{title}</h3>
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
}: {
  app: AppForEntry;
  loan: LoanApplication | null;
  reveal: boolean;
  pv: ProtectedValues;
  revealHref: string;
  hideHref: string;
  printHref?: string;
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
        <h2 className="text-base font-semibold text-gray-900">Application — reviewer entry view</h2>
        <div className="flex flex-wrap items-center gap-2">
          {printHref && (
            <a href={printHref} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
              Open full application ↗
            </a>
          )}
          {reveal ? (
            <Link href={hideHref} className="text-xs text-brand-700 hover:underline">
              Hide protected fields
            </Link>
          ) : (
            <Link href={revealHref} prefetch={false} className="btn-secondary text-xs">
              Reveal protected fields (logged)
            </Link>
          )}
        </div>
      </div>
      <p className="mb-2 text-xs text-gray-500">
        Read top to bottom — laid out in the order a lender’s application asks for it.
      </p>
      {reveal && (
        <p className="mb-4 rounded bg-amber-50 p-2 text-xs text-amber-700">
          Date of birth, street address, and ID numbers are shown. This access is recorded in the
          audit log.
        </p>
      )}

      <Group title="Personal details">
        <Field label="First / middle / last name" value={joinName(app.applicantFirstName, loan?.middleName, app.applicantLastName)} />
        <Field label="Birthdate" value={pv.dob} />
        <Field label="Marital status" value={nonEmpty(loan?.maritalStatus)} />
        <Field label="Home phone" value={nonEmpty(loan?.homePhone)} />
        <Field label="Mobile phone" value={app.applicantPhone} />
        <Field label="Email" value={app.applicantEmail} />
      </Group>

      <Group title="Housing">
        <Field label="Address" value={pv.address} />
        <Field label="City" value={nonEmpty(loan?.city)} />
        <Field label="Province" value={nonEmpty(loan?.addressProvince) ?? app.province} />
        <Field label="Postal code" value={nonEmpty(loan?.postalCode)} />
        <Field label="Years at this address" value={loan?.yearsAtAddress ?? null} />
        <Field label="Monthly housing costs" value={money(readEnc(loan?.monthlyHousingCostEnc, loan?.monthlyHousingCost))} />
        <Field label="Housing status (Own / Rent / Other)" value={loan?.housingStatus ? HOUSING[loan.housingStatus] : null} />
      </Group>

      {hasOther && (
        <Group title="Other addresses">
          <Field label="Mailing address" value={otherAddresses[0]} />
          <Field label="Previous address (if moved within 2 yrs)" value={otherAddresses[1]} />
          <Field label="Work-site address" value={otherAddresses[2]} />
        </Group>
      )}

      <Group title="Borrower identification">
        <Field label="Photo ID card type" value={nonEmpty(loan?.idType)} />
        <Field label="Photo ID number" value={pv.govId} mono />
        <Field label="Photo ID province" value={nonEmpty(loan?.idProvince)} />
        <Field label="Photo ID expiry" value={fmtDate(loan?.idExpiry)} />
      </Group>

      <Group title="Employment & income information">
        <Field label="Business name / employer" value={nonEmpty(loan?.businessName)} />
        <Field label="Position title" value={nonEmpty(loan?.positionTitle)} />
        <Field label="Employer address" value={nonEmpty(readEnc(loan?.employerAddressEnc, loan?.employerAddress))} />
        <Field label="Employer phone" value={nonEmpty(loan?.employerPhone)} />
        <Field label="Time at job (years)" value={loan?.timeAtJobYears ?? null} />
        <Field label="Gross monthly income" value={money(readEnc(loan?.grossMonthlyIncomeEnc, loan?.grossMonthlyIncome))} />
        <Field label="Employment status" value={loan?.employmentStatus ? EMPLOYMENT[loan.employmentStatus] : null} />
      </Group>

      {hasCo && loan && (
        <div className="mt-6 rounded-lg border border-brand-100 bg-brand-50/40 p-4">
          <h3 className="mb-1 text-sm font-semibold text-brand-900">
            Co-applicant{nonEmpty(loan.coRelationship) ? ` · ${loan.coRelationship}` : ''}
          </h3>
          <Group title="Personal details">
            <Field label="First / middle / last name" value={joinName(loan.coFirstName, loan.coMiddleName, loan.coLastName)} />
            <Field label="Birthdate" value={pv.coDob} />
            <Field label="Marital status" value={nonEmpty(loan.coMaritalStatus)} />
            <Field label="Home phone" value={nonEmpty(loan.coHomePhone)} />
            <Field label="Mobile phone" value={nonEmpty(loan.coPhone)} />
            <Field label="Email" value={nonEmpty(loan.coEmail)} />
          </Group>
          <Group title="Housing">
            <Field label="Address" value={pv.coAddress} />
            <Field label="City" value={nonEmpty(loan.coCity)} />
            <Field label="Province" value={nonEmpty(loan.coProvince)} />
            <Field label="Postal code" value={nonEmpty(loan.coPostal)} />
          </Group>
          <Group title="Borrower identification">
            <Field label="Photo ID card type" value={nonEmpty(loan.coIdType)} />
            <Field label="Photo ID number" value={pv.coGovId} mono />
            <Field label="Photo ID province" value={nonEmpty(loan.coIdProvince)} />
            <Field label="Photo ID expiry" value={fmtDate(loan.coIdExpiry)} />
          </Group>
          <Group title="Employment & income information">
            <Field label="Business name / employer" value={nonEmpty(loan.coBusinessName)} />
            <Field label="Position title" value={nonEmpty(loan.coPositionTitle)} />
            <Field label="Employer address" value={nonEmpty(readEnc(loan.coEmployerAddressEnc, loan.coEmployerAddress))} />
            <Field label="Employer phone" value={nonEmpty(loan.coEmployerPhone)} />
            <Field label="Time at job (years)" value={loan.coTimeAtJobYears ?? null} />
            <Field label="Gross monthly income" value={money(readEnc(loan.coGrossMonthlyIncomeEnc, loan.coGrossMonthlyIncome))} />
            <Field label="Employment status" value={loan.coEmploymentStatus ? EMPLOYMENT[loan.coEmploymentStatus] : null} />
          </Group>
        </div>
      )}

      <Group title="Financing / deal">
        <Field label="Program" value={programLabel(app.programType, app.programCategory)} />
        <Field label="Requested amount" value={money(app.requestedAmount)} />
        <Field label="Approved amount" value={money(app.approvedAmount)} />
        <Field label="Finance company" value={app.financeCompany?.name ?? null} />
        <Field label="Home Depot store" value={storeLabel} />
        <Field label="Date of sale" value={fmtDate(app.dateOfSale)} />
        <Field label="Installation date" value={fmtDate(app.installationDate)} />
        <Field label="Product(s) sold" value={app.productsSold.length ? app.productsSold.join(', ') : null} />
        <Field label="SOAP included" value={app.soapIncluded == null ? null : app.soapIncluded ? 'Yes' : 'No'} />
        <Field label="Salesperson" value={nonEmpty(app.salespersonName)} />
        <Field label="Installer" value={nonEmpty(app.installerName)} />
        <Field label="Financing deal number" value={nonEmpty(app.financeItNumber)} mono />
        <Field label="HD Customer #" value={nonEmpty(app.hdReference)} mono />
        <Field label="Entry method" value={app.entryMethod === 'TYPED' ? 'Typed in' : app.entryMethod === 'PHOTO' ? 'Photo upload' : 'FinanceIT #'} />
        <Field label="Approved by" value={app.approvedBy?.name ?? null} />
      </Group>

      {(app.financingNote || app.notes) && (
        <Group title="Notes">
          {app.financingNote && (
            <p className="rounded bg-gray-50 p-3 text-sm text-gray-600">
              <span className="font-medium text-gray-700">Financing note: </span>
              {app.financingNote}
            </p>
          )}
          {app.notes && <p className="mt-2 rounded bg-gray-50 p-3 text-sm text-gray-600">{app.notes}</p>}
        </Group>
      )}
    </section>
  );
}
