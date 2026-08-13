import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/AppShell';
import { AlertModal } from '@/components/AlertModal';
import { alertWhereForUser } from '@/lib/alerts';
import { prisma } from '@/lib/db';
import { canAdminSection, hasAnyAdminSection, isSuperAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  // Reviewers get the full staff nav. An admin only sees the staff areas they're
  // permitted: the Deals queue ('review-queue') and Mail ('mail'). Route guards
  // enforce the same rules.
  const canDeals = user.role === 'REVIEWER' || canAdminSection(user, 'review-queue');
  const canMail = user.role === 'REVIEWER' || canAdminSection(user, 'mail');
  const canDirectory = user.role === 'REVIEWER' || canAdminSection(user, 'directory');
  const nav: { href: string; label: string }[] = [];
  if (canDeals) nav.push({ href: '/staff', label: 'Deals' });
  if (canMail) nav.push({ href: '/staff/mail', label: 'Mail' });
  if (canDirectory) nav.push({ href: '/staff/directory', label: 'Directory' });
  if (await canViewReportsArea(user)) nav.push({ href: '/staff/reports', label: 'Reports' });
  if (isSuperAdmin(user) || canAdminSection(user, 'leads')) nav.push({ href: '/staff/leads', label: 'Leads' });
  nav.push({ href: '/account', label: 'My account' });
  // Admins with any back-end access get a jump link back to the admin area.
  if (user.role === 'ADMIN' && hasAnyAdminSection(user)) nav.push({ href: '/admin', label: 'Admin' });

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
