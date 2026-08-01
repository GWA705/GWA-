import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { decryptOptional } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { ReviewerEntryView } from '@/components/ReviewerEntryView';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

// A clean, full-page version of the application in lender-entry order, meant to
// be popped out into its own window and kept beside the finance company's portal
// while the reviewer re-keys it (or printed). Protected fields are revealed here
// (it's the reviewer's working copy) and the access is audited.
export default async function ApplicationPrintView({ params }: { params: { id: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const app = await prisma.application.findUnique({
    where: { id: params.id },
    include: {
      dealer: true,
      homeDepotStore: true,
      financeCompany: true,
      approvedBy: true,
      loanApplication: true,
    },
  });
  if (!app) notFound();

  const loan = app.loanApplication;
  const pv = {
    dob: decryptOptional(app.applicantDobEnc) ?? '—',
    address: decryptOptional(app.applicantAddressEnc) ?? '—',
    govId: decryptOptional(app.govIdNumberEnc) ?? '—',
    coDob: decryptOptional(loan?.coDobEnc) ?? '—',
    coAddress: decryptOptional(loan?.coAddressEnc) ?? '—',
    coGovId: decryptOptional(loan?.coGovIdNumberEnc) ?? '—',
  };

  await audit({
    actorId: user.userId,
    action: 'PII_DECRYPT',
    entityType: 'Application',
    entityId: app.id,
    detail: 'Opened full application (print/entry view)',
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/staff/applications/${app.id}`} className="text-sm text-gray-500 hover:underline">
          ← Back to deal
        </Link>
        <PrintButton />
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Loan application — {app.applicantFirstName} {app.applicantLastName}
        </h1>
        <p className="text-sm text-gray-500">
          {app.dealer.name} · for re-keying into the finance company
        </p>
      </div>

      <ReviewerEntryView
        app={app}
        loan={loan}
        reveal
        pv={pv}
        revealHref={`/staff/applications/${app.id}/print`}
        hideHref={`/staff/applications/${app.id}`}
      />
    </div>
  );
}
