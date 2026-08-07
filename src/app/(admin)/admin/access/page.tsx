import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/session';
import { prisma } from '@/lib/db';
import { ADMIN_SECTIONS } from '@/lib/constants';
import { AdminAccessForm, type AdminAccessUser } from './AdminAccessForm';

export const dynamic = 'force-dynamic';

export default async function AdminAccessPage() {
  const me = await requireSuperAdmin();

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true },
    orderBy: [{ superAdmin: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, superAdmin: true, adminSections: true },
  });

  const users: AdminAccessUser[] = admins.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    superAdmin: u.superAdmin,
    sections: u.adminSections,
    isSelf: u.id === me.userId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Admin access</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Control exactly which back-end sections each administrator can reach. A{' '}
          <span className="font-medium text-purple-700">Super Admin</span> has full access and is the
          only role that can manage access here. A scoped admin sees only the sections you switch on —
          the rest are hidden from their menu and blocked if they try the direct link.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          To give someone back-end access, first set their role to <span className="font-medium">Administrator</span> in{' '}
          <Link href="/admin/users" className="text-brand-700 hover:underline">Users</Link>, then scope them here.
        </p>
      </div>

      <div className="space-y-5">
        {users.map((u) => (
          <AdminAccessForm key={u.id} user={u} sections={ADMIN_SECTIONS} />
        ))}
        {users.length === 0 && (
          <div className="card p-6 text-sm text-gray-500">No administrators yet.</div>
        )}
      </div>
    </div>
  );
}
