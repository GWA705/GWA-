import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { DealerForm } from './DealerForm';
import { DealerRowActions } from './DealerRowActions';

export const dynamic = 'force-dynamic';

export default async function DealersPage() {
  await requireAdminSection('dealers');
  const dealers = await prisma.dealer.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, applications: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Dealers</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-xs text-gray-400">HD store → dealer list:</span>
          <a href="/api/admin/store-dealers" className="font-medium text-brand-700 hover:underline">
            Download CSV
          </a>
          <a href="/api/admin/store-dealers?format=json" className="font-medium text-brand-700 hover:underline" target="_blank" rel="noreferrer">
            JSON
          </a>
        </div>
      </div>
      <div className="card p-6">
        <DealerForm />
      </div>
      {/* Mobile: a card per dealer so nothing scrolls off-screen. */}
      <div className="space-y-3 sm:hidden">
        {dealers.map((d) => (
          <div key={d.id} className={`card p-4 ${d.active ? '' : 'bg-gray-50/60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-900">{d.name}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {d._count.users} user{d._count.users === 1 ? '' : 's'} · {d._count.applications} application{d._count.applications === 1 ? '' : 's'}
                </div>
              </div>
              <span className={`badge shrink-0 ${d.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {d.active ? 'Active' : 'Archived'}
              </span>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <DealerRowActions
                id={d.id}
                name={d.name}
                active={d.active}
                calculatorEnabled={d.calculatorEnabled}
                reportsEnabled={d.reportsEnabled}
                canDelete={d._count.users === 0 && d._count.applications === 0}
                align="start"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: the full table. */}
      <div className="card hidden overflow-x-auto sm:block">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Applications</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dealers.map((d) => (
              <tr key={d.id} className={d.active ? '' : 'bg-gray-50/60'}>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3">{d._count.users}</td>
                <td className="px-4 py-3">{d._count.applications}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${d.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {d.active ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <DealerRowActions
                    id={d.id}
                    name={d.name}
                    active={d.active}
                    calculatorEnabled={d.calculatorEnabled}
                    reportsEnabled={d.reportsEnabled}
                    canDelete={d._count.users === 0 && d._count.applications === 0}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        <strong>Archive</strong> hides a dealer and blocks new sign-ins while keeping their
        history — reversible with Unarchive. <strong>Delete</strong> is permanent and only offered
        for dealers with no users and no applications, so records that reference customer data are
        never destroyed.
      </p>
    </div>
  );
}
