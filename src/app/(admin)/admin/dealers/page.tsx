import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { toggleDealerActiveAction } from '@/app/(admin)/actions';
import { DealerForm } from './DealerForm';

export const dynamic = 'force-dynamic';

export default async function DealersPage() {
  await requireRole('ADMIN');
  const dealers = await prisma.dealer.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, applications: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dealers</h1>
      <div className="card p-6">
        <DealerForm />
      </div>
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Applications</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dealers.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d._count.users}</td>
                <td className="px-4 py-3">{d._count.applications}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${d.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {d.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={toggleDealerActiveAction.bind(null, d.id)}>
                    <button type="submit" className="btn-secondary text-xs">
                      {d.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
