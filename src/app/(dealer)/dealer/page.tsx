import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { applicationScopeWhere } from '@/lib/rbac';
import { StatusBadge } from '@/components/StatusBadge';
import { STATUS_LABELS } from '@/lib/constants';

export default async function DealerHome() {
  const user = await requireRole('DEALER_USER');
  const apps = await prisma.application.findMany({
    where: applicationScopeWhere(user),
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Applications</h1>
        <Link href="/dealer/applications/new" className="btn-primary">
          New application
        </Link>
      </div>

      {apps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">
          No applications yet. Start by creating a new application.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Province</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dealer/applications/${a.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {a.applicantFirstName} {a.applicantLastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{a.province}</td>
                  <td className="px-4 py-3">{a.program}</td>
                  <td className="px-4 py-3">${a.requestedAmount.toString()}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {a.createdAt.toLocaleDateString('en-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
