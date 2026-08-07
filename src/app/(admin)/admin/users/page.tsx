import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { roleLabel } from '@/lib/rbac';
import { UserForm } from './UserForm';
import { UsersDirectory, type DirGroup, type DirUser } from './UsersDirectory';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const admin = await requireAdminSection('users');
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
  // each sorted by name. The admin can then pick a group to show and hide the
  // rest (see UsersDirectory).
  const toDirUser = (u: (typeof users)[number]): DirUser => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roleLabel: roleLabel(u.role),
    mfaEnabled: u.mfaEnabled,
    active: u.active,
    canDelete: Object.values(u._count).reduce((a, b) => a + b, 0) === 0,
    isSelf: u.id === admin.userId,
  });
  const byName = (a: DirUser, b: DirUser) => a.name.localeCompare(b.name);

  const internal = users.filter((u) => !u.dealerId).map(toDirUser).sort(byName);
  const dealerMap = new Map<string, DirGroup>();
  for (const u of users) {
    if (!u.dealerId) continue;
    if (!dealerMap.has(u.dealerId)) {
      dealerMap.set(u.dealerId, { key: u.dealerId, name: u.dealer?.name ?? 'Unknown dealer', users: [] });
    }
    dealerMap.get(u.dealerId)!.users.push(toDirUser(u));
  }
  const dealerGroups = [...dealerMap.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({ ...g, users: [...g.users].sort(byName) }));

  const groups: DirGroup[] = [
    ...(internal.length ? [{ key: 'internal', name: 'GWA — internal staff', users: internal }] : []),
    ...dealerGroups,
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Users</h1>
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Create user</h2>
        <UserForm dealers={dealers} />
      </div>

      <UsersDirectory groups={groups} />
    </div>
  );
}
