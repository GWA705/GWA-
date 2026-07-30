import type { LoanApplication } from '@prisma/client';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

const HOUSING: Record<string, string> = { OWN: 'Own', RENT: 'Rent', OTHER: 'Other' };
const EMPLOYMENT: Record<string, string> = {
  EMPLOYED: 'Employed',
  SELF_EMPLOYED: 'Self-employed',
  RETIRED: 'Retired',
  OTHER: 'Other',
};

function addressLine(street?: string | null, city?: string | null, prov?: string | null, postal?: string | null) {
  const parts = [street, city, prov, postal].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

// Decrypted co-applicant sensitive values, supplied by the page (which owns the
// crypto + audit path). Omitted values simply don't render.
export interface CoApplicantReveal {
  dob?: string | null;
  address?: string | null;
  govId?: string | null;
}

export function LoanApplicationDetails({
  loan,
  co,
}: {
  loan: LoanApplication;
  co?: CoApplicantReveal;
}) {
  const hasCo = !!(loan.coFirstName || loan.coLastName);
  return (
    <section className="card p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Loan application details</h2>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Personal &amp; housing</h3>
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <Row label="Middle name" value={loan.middleName} />
        <Row label="Home phone" value={loan.homePhone} />
        <Row label="Marital status" value={loan.maritalStatus} />
        <Row label="City" value={loan.city} />
        <Row label="Province" value={loan.addressProvince} />
        <Row label="Postal code" value={loan.postalCode} />
        <Row label="Housing status" value={loan.housingStatus ? HOUSING[loan.housingStatus] : null} />
        <Row label="Monthly housing cost" value={loan.monthlyHousingCost ? `$${loan.monthlyHousingCost.toString()}` : null} />
        <Row label="Years at address" value={loan.yearsAtAddress} />
        <Row label="Mailing address" value={addressLine(loan.mailingAddress, loan.mailingCity, loan.mailingProvince, loan.mailingPostal)} />
        <Row label="Previous address" value={addressLine(loan.previousAddress, loan.previousCity, loan.previousProvince, loan.previousPostal)} />
        <Row label="Work-site address" value={addressLine(loan.worksiteAddress, loan.worksiteCity, loan.worksiteProvince, loan.worksitePostal)} />
      </dl>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">Identification</h3>
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <Row label="ID type" value={loan.idType} />
        <Row label="Province of issue" value={loan.idProvince} />
        <Row label="Expiry" value={loan.idExpiry ? loan.idExpiry.toLocaleDateString('en-CA') : null} />
      </dl>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">Employment &amp; income</h3>
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <Row label="Employer" value={loan.businessName} />
        <Row label="Position" value={loan.positionTitle} />
        <Row label="Employer address" value={loan.employerAddress} />
        <Row label="Employer phone" value={loan.employerPhone} />
        <Row label="Gross monthly income" value={loan.grossMonthlyIncome ? `$${loan.grossMonthlyIncome.toString()}` : null} />
        <Row label="Time at job (yrs)" value={loan.timeAtJobYears} />
        <Row label="Employment status" value={loan.employmentStatus ? EMPLOYMENT[loan.employmentStatus] : null} />
      </dl>

      {hasCo && (
        <div className="mt-6 rounded-lg border border-brand-100 bg-brand-50/40 p-4">
          <h3 className="mb-3 text-sm font-semibold text-brand-900">
            Co-applicant{loan.coRelationship ? ` · ${loan.coRelationship}` : ''}
          </h3>

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Row label="Name" value={[loan.coFirstName, loan.coMiddleName, loan.coLastName].filter(Boolean).join(' ')} />
            <Row label="Date of birth" value={co?.dob} />
            <Row label="Marital status" value={loan.coMaritalStatus} />
            <Row label="Email" value={loan.coEmail} />
            <Row label="Mobile phone" value={loan.coPhone} />
            <Row label="Home phone" value={loan.coHomePhone} />
            <Row label="Address" value={addressLine(co?.address, loan.coCity, loan.coProvince, loan.coPostal)} />
          </dl>

          <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Identification</h4>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Row label="ID type" value={loan.coIdType} />
            <Row label="ID #" value={co?.govId ? <span className="font-mono">{co.govId}</span> : null} />
            <Row label="Province of issue" value={loan.coIdProvince} />
            <Row label="Expiry" value={loan.coIdExpiry ? loan.coIdExpiry.toLocaleDateString('en-CA') : null} />
          </dl>

          <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Employment &amp; income</h4>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Row label="Employer" value={loan.coBusinessName} />
            <Row label="Position" value={loan.coPositionTitle} />
            <Row label="Employer address" value={loan.coEmployerAddress} />
            <Row label="Employer phone" value={loan.coEmployerPhone} />
            <Row label="Gross monthly income" value={loan.coGrossMonthlyIncome ? `$${loan.coGrossMonthlyIncome.toString()}` : null} />
            <Row label="Time at job (yrs)" value={loan.coTimeAtJobYears} />
            <Row label="Employment status" value={loan.coEmploymentStatus ? EMPLOYMENT[loan.coEmploymentStatus] : null} />
          </dl>
        </div>
      )}
    </section>
  );
}
