import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { NewCaseForm } from '../NewCaseForm';

export const dynamic = 'force-dynamic';

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: { applicationId?: string; gmailThreadId?: string; title?: string; hdCase?: string; hdRef?: string; name?: string };
}) {
  await requireRole('REVIEWER', 'ADMIN');
  const gmailThreadId = searchParams.gmailThreadId?.trim() || undefined;
  const prefillTitle = searchParams.title?.trim() || undefined;
  const prefillHdCase = searchParams.hdCase?.trim() || undefined;
  const hdRef = searchParams.hdRef?.trim() || undefined;
  const parsedName = searchParams.name?.trim() || undefined;

  // Resolve the customer's existing deal: an explicit applicationId, or (the new
  // path) a match on the HD Ref # parsed from the email subject. A match brings
  // the office + documents with the case.
  const appId = searchParams.applicationId?.trim();
  const app = appId
    ? await prisma.application.findUnique({
        where: { id: appId },
        select: { id: true, applicantFirstName: true, applicantLastName: true, applicantPhone: true, hdReference: true, dealer: { select: { name: true } } },
      })
    : hdRef
      ? await prisma.application.findFirst({
          where: { hdReference: hdRef },
          orderBy: { createdAt: 'desc' },
          select: { id: true, applicantFirstName: true, applicantLastName: true, applicantPhone: true, hdReference: true, dealer: { select: { name: true } } },
        })
      : null;

  const linkedDeal = app
    ? { applicationId: app.id, customerName: `${app.applicantFirstName} ${app.applicantLastName}`.trim(), officeName: app.dealer?.name ?? '—' }
    : null;

  // Editable pre-fills: prefer the matched deal, else what we parsed from the email.
  const prefillCustomerName = linkedDeal?.customerName ?? (parsedName ? titleCase(parsedName) : undefined);
  const prefillCustomerPhone = app?.applicantPhone ?? undefined;
  const prefillHdRef = app?.hdReference ?? hdRef ?? undefined;

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/staff/resolutions" className="text-sm text-gray-500 hover:underline">← Back to the queue</Link>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">New HD resolution case</h1>
      <NewCaseForm
        linkedDeal={linkedDeal}
        gmailThreadId={gmailThreadId}
        prefillTitle={prefillTitle}
        prefillHdCase={prefillHdCase}
        prefillCustomerName={prefillCustomerName}
        prefillCustomerPhone={prefillCustomerPhone}
        prefillHdRef={prefillHdRef}
      />
    </div>
  );
}
