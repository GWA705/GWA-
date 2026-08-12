import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { EditUserForm } from '../../EditUserForm';

export const dynamic = 'force-dynamic';

export default async function EditUserPage({ params }: { params: { id: string } }) {
  await requireAdminSection('users');
  const [user, dealers] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.dealer.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!user) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-gray-500 hover:underline">← Back to users</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Edit user</h1>
        <p className="mt-1 text-sm text-gray-500">
          Changes take effect the next time they sign in (a role or dealer change refreshes on their next login).
        </p>
      </div>
      <div className="card p-6">
        <EditUserForm
          user={{ id: user.id, name: user.name, email: user.email, role: user.role, dealerId: user.dealerId, isDistributor: user.isDistributor, canUseCalculator: user.canUseCalculator }}
          dealers={dealers}
        />
      </div>
    </div>
  );
}
