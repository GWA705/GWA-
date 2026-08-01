import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audienceLabel } from '@/lib/alerts';
import { AlertForm } from './AlertForm';
import { AlertRowActions } from './AlertRowActions';

export const dynamic = 'force-dynamic';

export default async function DealerAlertsPage() {
  await requireRole('ADMIN');

  const [alerts, dealers, dealerUserCount, reviewerCount, adminCount] = await Promise.all([
    prisma.dealerAlert.findMany({
      orderBy: { createdAt: 'desc' },
      include: { dealer: true, _count: { select: { acks: true } } },
    }),
    prisma.dealer.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.count({ where: { role: 'DEALER_USER', active: true } }),
    prisma.user.count({ where: { role: 'REVIEWER', active: true } }),
    prisma.user.count({ where: { role: 'ADMIN', active: true } }),
  ]);

  // How many users each alert targets, by audience.
  const perDealerCounts = new Map<string, number>();
  const grouped = await prisma.user.groupBy({
    by: ['dealerId'],
    where: { role: 'DEALER_USER', active: true, dealerId: { not: null } },
    _count: true,
  });
  for (const g of grouped) if (g.dealerId) perDealerCounts.set(g.dealerId, g._count);

  const targetFor = (audience: string, dealerId: string | null): number => {
    switch (audience) {
      case 'ALL_DEALERS': return dealerUserCount;
      case 'DEALER': return dealerId ? perDealerCounts.get(dealerId) ?? 0 : 0;
      case 'REVIEWERS': return reviewerCount;
      case 'ADMINS': return adminCount;
      case 'STAFF': return reviewerCount + adminCount;
      case 'EVERYONE': return dealerUserCount + reviewerCount + adminCount;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Pop-up messages</h1>
        <p className="mt-1 text-sm text-gray-500">
          A must-read pop-up. Choose who sees it — all dealers, a specific dealer, reviewers,
          admins, staff, or everyone — so you can send reviewers messages you don’t send dealers.
          They have to press X to close it, and the portal records who has read it. Different from
          the dashboard “sign,” which they can ignore.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">New pop-up</h2>
        <AlertForm dealers={dealers} />
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Read by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {alerts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No pop-ups yet.</td></tr>
            ) : (
              alerts.map((a) => {
                const audience =
                  a.audience === 'DEALER' && a.dealer ? a.dealer.name : audienceLabel(a.audience);
                const target = targetFor(a.audience, a.dealerId);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{a.title}</div>
                      <div className="max-w-md truncate text-xs text-gray-500">{a.body}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{audience}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {a._count.acks} / {target}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${a.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {a.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{a.createdAt.toLocaleDateString('en-CA')}</td>
                    <td className="px-4 py-3 text-right">
                      <AlertRowActions id={a.id} title={a.title} active={a.active} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
