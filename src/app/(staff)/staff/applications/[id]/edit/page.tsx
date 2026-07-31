import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { decryptOptional } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { EditDealForm, type EditInitial } from '../EditDealForm';

export const dynamic = 'force-dynamic';

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
const decDate = (enc: string | null) => {
  const v = decryptOptional(enc);
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};
const num = (n: { toString(): string } | null | undefined) => (n === null || n === undefined ? '' : n.toString());

export default async function EditDealPage({ params }: { params: { id: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const app = await prisma.application.findUnique({
    where: { id: params.id },
    include: { loanApplication: true },
  });
  if (!app) notFound();

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  });

  // Editing reveals the protected identity fields — record the access.
  await audit({
    actorId: user.userId,
    action: 'PII_DECRYPT',
    entityType: 'Application',
    entityId: app.id,
    detail: 'Opened edit form (identity fields revealed)',
  });

  const l = app.loanApplication;
  const initial: EditInitial = {
    province: app.province,
    programType: app.programType,
    programCategory: app.programCategory,
    requestedAmount: num(app.requestedAmount),
    approvedAmount: num(app.approvedAmount),
    applicantFirstName: app.applicantFirstName,
    applicantLastName: app.applicantLastName,
    applicantEmail: app.applicantEmail,
    applicantPhone: app.applicantPhone,
    applicantDob: decDate(app.applicantDobEnc),
    applicantAddress: decryptOptional(app.applicantAddressEnc) ?? '',
    govIdNumber: decryptOptional(app.govIdNumberEnc) ?? '',
    dateOfSale: ymd(app.dateOfSale),
    installationDate: ymd(app.installationDate),
    financingNote: app.financingNote ?? '',
    notes: app.notes ?? '',
    salespersonName: app.salespersonName ?? '',
    installerName: app.installerName ?? '',
    soapIncluded: app.soapIncluded === true ? 'YES' : app.soapIncluded === false ? 'NO' : '',
    productsSold: app.productsSold,
    middleName: l?.middleName ?? '',
    homePhone: l?.homePhone ?? '',
    maritalStatus: l?.maritalStatus ?? '',
    housingStatus: l?.housingStatus ?? '',
    monthlyHousingCost: num(l?.monthlyHousingCost),
    yearsAtAddress: num(l?.yearsAtAddress),
    city: l?.city ?? '',
    addressProvince: l?.addressProvince ?? '',
    postalCode: l?.postalCode ?? '',
    idType: l?.idType ?? '',
    idProvince: l?.idProvince ?? '',
    idExpiry: ymd(l?.idExpiry),
    businessName: l?.businessName ?? '',
    positionTitle: l?.positionTitle ?? '',
    employerAddress: l?.employerAddress ?? '',
    employerPhone: l?.employerPhone ?? '',
    grossMonthlyIncome: num(l?.grossMonthlyIncome),
    timeAtJobYears: num(l?.timeAtJobYears),
    employmentStatus: l?.employmentStatus ?? '',
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href={`/staff/applications/${app.id}`} className="text-sm text-gray-500 hover:underline">← Back to deal</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">
          Edit deal — {app.applicantFirstName} {app.applicantLastName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Update applicant and deal details. Changes are logged.</p>
      </div>
      <EditDealForm applicationId={app.id} initial={initial} products={products} />
    </div>
  );
}
