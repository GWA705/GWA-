import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { StorageCheck } from './StorageCheck';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  await requireRole('ADMIN');
  const [dealers, users, apps, funded, pendingReview] = await Promise.all([
    prisma.dealer.count(),
    prisma.user.count(),
    prisma.application.count(),
    prisma.application.count({ where: { status: 'FUNDED' } }),
    prisma.application.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
  ]);

  const cards = [
    { label: 'Dealers', value: dealers, href: '/admin/dealers' },
    { label: 'Users', value: users, href: '/admin/users' },
    { label: 'Applications', value: apps, href: '/staff' },
    { label: 'Pending review', value: pendingReview, href: '/staff' },
    { label: 'Funded', value: funded, href: '/staff?filter=funded' },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card p-5 transition hover:shadow">
            <div className="text-3xl font-semibold text-brand-700">{c.value}</div>
            <div className="mt-1 text-sm text-gray-500">{c.label}</div>
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <StorageCheck />
      </div>
    </div>
  );
}
