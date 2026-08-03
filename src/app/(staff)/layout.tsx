import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/AppShell';
import { AlertModal } from '@/components/AlertModal';
import { alertWhereForUser } from '@/lib/alerts';
import { prisma } from '@/lib/db';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const nav = [
    { href: '/staff', label: 'Deals' },
    { href: '/staff/mail', label: 'Mail' },
    { href: '/account', label: 'My account' },
  ];
  if (user.role === 'ADMIN') nav.push({ href: '/admin', label: 'Admin' });

  const alerts = await prisma.dealerAlert.findMany({
    where: alertWhereForUser(user.role, user.dealerId, user.userId),
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, body: true, linkUrl: true },
  });

  return (
    <AppShell user={user} portal="staff" nav={nav}>
      {children}
      {alerts.length > 0 && <AlertModal alerts={alerts} />}
    </AppShell>
  );
}
