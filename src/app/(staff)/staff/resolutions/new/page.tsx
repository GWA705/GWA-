import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { NewCaseForm } from '../NewCaseForm';

export const dynamic = 'force-dynamic';

export default async function NewCasePage({ searchParams }: { searchParams: { applicationId?: string } }) {
  await requireRole('REVIEWER', 'ADMIN');

  let prefill: { applicationId: string; customerName: string; officeName: string; hdReference: string | null } | null = null;
  const appId = searchParams.applicationId?.trim();
  if (appId) {
    const app = await prisma.application.findUnique({
      where: { id: appId },
      select: { id: true, applicantFirstName: true, applicantLastName: true, hdReference: true, dealer: { select: { name: true } } },
    });
    if (app) {
      prefill = {
        applicationId: app.id,
        customerName: `${app.applicantFirstName} ${app.applicantLastName}`.trim(),
        officeName: app.dealer?.name ?? '—',
        hdReference: app.hdReference,
      };
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/staff/resolutions" className="text-sm text-gray-500 hover:underline">← Back to the queue</Link>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">New HD resolution case</h1>
      <NewCaseForm prefill={prefill} />
    </div>
  );
}
