import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/AppShell';
import { AlertModal } from '@/components/AlertModal';
import { alertWhereForUser } from '@/lib/alerts';
import { prisma } from '@/lib/db';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('ADMIN');
  const alerts = await prisma.dealerAlert.findMany({
    where: alertWhereForUser(user.role, user.dealerId, user.userId),
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, body: true, linkUrl: true },
  });
  return (
    <AppShell
      user={user}
      nav={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/dealers', label: 'Dealers' },
        { href: '/admin/finance-companies', label: 'Finance cos' },
        { href: '/admin/products', label: 'Products' },
        { href: '/admin/announcements', label: 'Dealer portal sign' },
        { href: '/admin/alerts', label: 'Pop-up alerts' },
        { href: '/admin/reminders', label: 'Dealer reminders' },
        { href: '/admin/note-templates', label: 'Quick notes' },
        { href: '/admin/content', label: 'Content' },
        { href: '/admin/marketplace', label: 'Marketplace' },
        { href: '/staff/mail', label: 'Mail' },
        { href: '/admin/users', label: 'Users' },
        { href: '/admin/security', label: 'Security' },
        { href: '/admin/email', label: 'Email' },
        { href: '/admin/audit', label: 'Audit log' },
        { href: '/staff', label: 'Review queue' },
        { href: '/account', label: 'My account' },
      ]}
    >
      {children}
      {alerts.length > 0 && <AlertModal alerts={alerts} />}
    </AppShell>
  );
}
