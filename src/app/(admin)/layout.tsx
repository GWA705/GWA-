import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/AppShell';
import { AlertModal } from '@/components/AlertModal';
import { alertWhereForUser } from '@/lib/alerts';
import { prisma } from '@/lib/db';
import { canAdminSection, isSuperAdmin, hasAnyAdminSection } from '@/lib/rbac';
import { ADMIN_SECTIONS } from '@/lib/constants';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('ADMIN');

  // A scoped admin with no back-end access at all doesn't belong in this area.
  if (!hasAnyAdminSection(user)) redirect('/account');

  // Build the nav from the sections this admin is actually allowed to see, so a
  // scoped admin never sees a tab they can't open. Route guards enforce it too.
  const nav = ADMIN_SECTIONS.filter((s) => canAdminSection(user, s.key)).map((s) => ({
    href: s.href,
    label: s.label,
  }));
  // Only a Super Admin manages other admins' access.
  if (isSuperAdmin(user)) nav.push({ href: '/admin/access', label: 'Admin access' });
  nav.push({ href: '/account', label: 'My account' });

  const alerts = await prisma.dealerAlert.findMany({
    where: alertWhereForUser(user.role, user.dealerId, user.userId),
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, body: true, linkUrl: true },
  });
  return (
    <AppShell user={user} nav={nav}>
      {children}
      {alerts.length > 0 && <AlertModal alerts={alerts} />}
    </AppShell>
  );
}
