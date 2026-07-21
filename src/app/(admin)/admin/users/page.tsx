import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { roleLabel } from '@/lib/rbac';
import { toggleUserActiveAction } from '@/app/(admin)/actions';
import { UserForm } from './UserForm';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const admin = await requireRole('ADMIN');
  const [users, dealers] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, include: { dealer: true } }),
    prisma.dealer.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Users</h1>
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Create user</h2>
        <UserForm dealers={dealers} />
      </div>
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Dealer</th>
              <th className="px-4 py-3">2FA</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">{roleLabel(u.role)}</td>
                <td className="px-4 py-3 text-gray-600">{u.dealer?.name ?? '—'}</td>
                <td className="px-4 py-3">{u.mfaEnabled ? '✓' : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id !== admin.userId && (
                    <form action={toggleUserActiveAction.bind(null, u.id)}>
                      <button type="submit" className="btn-secondary text-xs">
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
