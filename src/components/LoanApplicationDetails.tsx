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
  OTHER: 'Other',
};

function addressLine(street?: string | null, city?: string | null, prov?: string | null, postal?: string | null) {
  const parts = [street, city, prov, postal].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function LoanApplicationDetails({ loan }: { loan: LoanApplication }) {
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
    </section>
  );
}
