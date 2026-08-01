import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { roleLabel } from '@/lib/rbac';
import { UserForm } from './UserForm';
import { UserRowActions } from './UserRowActions';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const admin = await requireRole('ADMIN');
  const [users, dealers] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        dealer: true,
        _count: {
          select: {
            applicationsCreated: true,
            applicationsApproved: true,
            documentsUploaded: true,
            documentsVerified: true,
            decisions: true,
            statusEvents: true,
            auditLogs: true,
            payoutsRecorded: true,
            notesAuthored: true,
            confirmations: true,
          },
        },
      },
    }),
    prisma.dealer.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  // Group users so the list isn't one long scroll: internal GWA staff
  // (reviewers/admins, no dealer) first, then one section per dealer (A→Z),
  // each sorted by name.
  const byName = (a: (typeof users)[number], b: (typeof users)[number]) =>
    a.name.localeCompare(b.name);
  const internal = users.filter((u) => !u.dealerId).sort(byName);
  const dealerMap = new Map<string, { name: string; users: typeof users }>();
  for (const u of users) {
    if (!u.dealerId) continue;
    if (!dealerMap.has(u.dealerId)) {
      dealerMap.set(u.dealerId, { name: u.dealer?.name ?? 'Unknown dealer', users: [] });
    }
    dealerMap.get(u.dealerId)!.users.push(u);
  }
  const dealerGroups = [...dealerMap.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({ ...g, users: [...g.users].sort(byName) }));

  const groups: { name: string; users: typeof users }[] = [
    ...(internal.length ? [{ name: 'GWA — internal staff', users: internal }] : []),
    ...dealerGroups,
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Users</h1>
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Create user</h2>
        <UserForm dealers={dealers} />
      </div>

      {groups.map((group) => (
        <div key={group.name} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">{group.name}</h2>
            <span className="badge bg-gray-100 text-gray-600">
              {group.users.length} {group.users.length === 1 ? 'user' : 'users'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">2FA</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">{roleLabel(u.role)}</td>
                    <td className="px-4 py-3">{u.mfaEnabled ? '✓' : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== admin.userId && (
                        <UserRowActions
                          id={u.id}
                          name={u.name}
                          active={u.active}
                          canDelete={Object.values(u._count).reduce((a, b) => a + b, 0) === 0}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
